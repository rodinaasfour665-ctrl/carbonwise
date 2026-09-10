// backend/src/chat/chatEngine.js
// Grounded Sustainability Chatbot — orchestration
//
// Flow:
//   1. Build the structured, company-specific context (contextBuilder.js) -
//      the ONLY data the model is ever allowed to see.
//   2. Detect "what if" questions BEFORE the LLM sees the question at all
//      (whatifDetector.js). If detected, run the EXISTING What-if Engine
//      (routes/whatif.js's runWhatIf()) to get the real before/after
//      numbers. The LLM (if configured) is only ever asked to phrase those
//      already-computed numbers in plain English - it never calculates a
//      what-if result itself.
//   3. For every other question, the LLM (if configured) is given the full
//      grounded context and a strict system prompt: answer ONLY from the
//      JSON provided, never invent a company-specific number, and if the
//      context doesn't contain what's needed, reply with the exact
//      required fallback sentence.
//   4. If no ANTHROPIC_API_KEY is configured, or the API call fails for any
//      reason, the chatbot falls back to a fully deterministic, template-
//      based answer engine that reads the exact same context - so the
//      "no hallucination" guarantee holds whether or not the LLM is
//      available (per the spec: "If an LLM is not configured, create the
//      chatbot architecture so the data/context layer is ready").

const { isWhatIfQuestion, detectWhatIf } = require("./whatifDetector");
const { runWhatIf } = require("../routes/whatif");
const { askLLM, isConfigured } = require("./llmClient");

const NO_DATA_ANSWER = "I don't have enough data to answer this question.";
const UNRECOGNIZED_ANSWER =
    'I can help with questions about emissions, costs, recommendations, the action plan, or what-if scenarios - for example, "What is our biggest emission source?" or "What if we reduce diesel by 20%?"';

// ---------------------------------------------------------------------------
// Formatting helpers (shared by the deterministic fallback templates)
// ---------------------------------------------------------------------------
function fmtKg(n) {
    return `${Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 1 })} kg CO2e`;
}
function fmtEGP(n) {
    return `EGP ${Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}
function fmtYears(n) {
    if (n === null || n === undefined) return "no meaningful payback period (a low/no-cost action)";
    return `${Number(n).toFixed(1)} years`;
}

// ---------------------------------------------------------------------------
// Deterministic intent classification + templated answers (the fallback
// engine, and also what runs when no LLM is configured at all)
// ---------------------------------------------------------------------------
const INTENTS = [
    { name: "biggest_emission_source", test: (m) => /biggest|largest|main|top/.test(m) && /emission|co2e?|carbon/.test(m) && !/cost/.test(m) },
    { name: "biggest_cost_driver", test: (m) => /(cost|expensive)/.test(m) && /most|biggest|highest|top/.test(m) && !/per employee/.test(m) },
    { name: "cost_per_employee", test: (m) => /cost per employee/.test(m) },
    { name: "highest_scope", test: (m) => /scope/.test(m) && /highest|most|biggest/.test(m) },
    { name: "shortest_payback", test: (m) => /payback/.test(m) && /shortest|fastest|quickest|best/.test(m) },
    { name: "quick_wins", test: (m) => /quick win/.test(m) },
    { name: "prioritize", test: (m) => /prioriti[sz]e|focus on|what should we do/.test(m) },
    { name: "potential_savings", test: (m) => /how much.*save|potential saving|savings/.test(m) },
];

function classifyIntent(message) {
    const m = message.toLowerCase();
    for (const intent of INTENTS) {
        if (intent.test(m)) return intent.name;
    }
    return null;
}

function answerBiggestEmissionSource(context) {
    if (!context.topEmissionSources.length) return NO_DATA_ANSWER;
    const top = context.topEmissionSources[0];
    const pct = ((top.value / context.emissionSummary.totalCo2eKg) * 100).toFixed(1);
    return `Your biggest emission source is "${top.key}", responsible for ${fmtKg(top.value)} - ${pct}% of your total footprint of ${fmtKg(context.emissionSummary.totalCo2eKg)}.`;
}

function answerBiggestCostDriver(context) {
    if (!context.topCostDrivers.length) return NO_DATA_ANSWER;
    const top = context.topCostDrivers[0];
    return `Your biggest cost driver is "${top.key}", costing an estimated ${fmtEGP(top.value)} per year, out of a total annualized cost of ${fmtEGP(context.costSummary.annualizedCostEGP)}.`;
}

function answerCostPerEmployee(context) {
    if (context.costSummary.costPerEmployeeEGP == null) return NO_DATA_ANSWER;
    return `Your annualized sustainability-related cost per employee is ${fmtEGP(context.costSummary.costPerEmployeeEGP)} (based on ${context.companyProfile.employees} employees).`;
}

function answerHighestScope(context) {
    const entries = Object.entries(context.scopeBreakdown || {}).filter(([, v]) => v > 0);
    if (!entries.length) return NO_DATA_ANSWER;
    entries.sort((a, b) => b[1] - a[1]);
    const [scope, value] = entries[0];
    return `${scope} has your highest emissions, at ${fmtKg(value)} out of ${fmtKg(context.emissionSummary.totalCo2eKg)} total.`;
}

function answerShortestPayback(context) {
    const withPayback = context.recommendations.filter((r) => r.paybackYears != null);
    if (!withPayback.length) return NO_DATA_ANSWER;
    withPayback.sort((a, b) => a.paybackYears - b.paybackYears);
    const r = withPayback[0];
    return `"${r.action}" has the shortest payback, at ${fmtYears(r.paybackYears)} - it costs an estimated ${fmtEGP(r.implementationCostEGP)} to implement and saves about ${fmtEGP(r.annualSavingsEGP)} per year.`;
}

function answerQuickWins(context) {
    const wins = context.actionPlan.quickWins;
    if (!wins.length) return "You don't currently have any quick-win recommendations - your top actions all need a longer implementation horizon.";
    const list = wins.slice(0, 5).map((w) => `${w.title} (${fmtKg(w.co2ReductionKg)}/yr, ${fmtEGP(w.annualSavingsEGP)}/yr saved)`).join("; ");
    return `Your quick wins (low difficulty, fast payback) are: ${list}.`;
}

function answerPrioritize(context) {
    if (!context.recommendations.length) return NO_DATA_ANSWER;
    const top = [...context.recommendations].sort((a, b) => b.priorityScore - a.priorityScore)[0];
    return `Based on emissions impact, savings, cost and effort, your top priority should be "${top.action}" (priority score ${top.priorityScore}/100) - an estimated ${fmtKg(top.co2ReductionKg)}/yr reduction and ${fmtEGP(top.annualSavingsEGP)}/yr in savings.`;
}

function answerPotentialSavings(context) {
    if (!context.recommendations.length) return NO_DATA_ANSWER;
    const total = context.recommendations.reduce((sum, r) => sum + (r.annualSavingsEGP || 0), 0);
    return `If you implemented all ${context.recommendations.length} current recommendations, you could save an estimated ${fmtEGP(total)} per year in total.`;
}

const HANDLERS = {
    biggest_emission_source: answerBiggestEmissionSource,
    biggest_cost_driver: answerBiggestCostDriver,
    cost_per_employee: answerCostPerEmployee,
    highest_scope: answerHighestScope,
    shortest_payback: answerShortestPayback,
    quick_wins: answerQuickWins,
    prioritize: answerPrioritize,
    potential_savings: answerPotentialSavings,
};

function deterministicGeneralAnswer(context, message) {
    const intent = classifyIntent(message);
    if (!intent) return { answer: UNRECOGNIZED_ANSWER, intent: null };
    return { answer: HANDLERS[intent](context), intent };
}

function deterministicWhatIfAnswer(context, message) {
    const detected = detectWhatIf(message, context.activityTypesPresent);
    if (!detected || detected.modifications.length === 0) return { answer: NO_DATA_ANSWER, intent: "whatif" };

    let result;
    try {
        result = runWhatIf({ companyId: context.companyProfile.id, modifications: detected.modifications });
    } catch {
        return { answer: NO_DATA_ANSWER, intent: "whatif" };
    }

    const co2Delta = result.baselineFootprint.totalCo2eKg - result.footprint.totalCo2eKg;
    const costDelta = result.baselineCosts.annualizedCostEGP - result.costs.annualizedCostEGP;
    const typesLabel = detected.modifications.map((m) => `"${m.type}" by ${m.reductionPct}%`).join(", ");

    const answer = `Reducing ${typesLabel} would lower your total emissions from ${fmtKg(result.baselineFootprint.totalCo2eKg)} to ${fmtKg(result.footprint.totalCo2eKg)} - a saving of ${fmtKg(co2Delta)}. Annualized cost would drop by about ${fmtEGP(costDelta)} per year.`;
    return { answer, intent: "whatif" };
}

// ---------------------------------------------------------------------------
// LLM-backed prompts (only ever fed the structured context, never raw DB rows)
// ---------------------------------------------------------------------------
const GENERAL_SYSTEM_PROMPT_HEADER = `You are the CarbonWise Assistant, a grounded sustainability chatbot for a specific company.

RULES (follow strictly):
1. Answer ONLY using the JSON context provided below. It contains this company's real, already-calculated sustainability data (emissions, costs, scope breakdown, recommendations, action plan).
2. NEVER invent, estimate, or guess any company-specific number that is not present in the JSON context.
3. If the JSON context does not contain the information needed to answer the question, reply with EXACTLY this sentence and nothing else: "I don't have enough data to answer this question."
4. Keep answers short (1-4 sentences), concrete, and cite the specific numbers from the context that support your answer.
5. Do not perform "what if" style hypothetical calculations yourself - those are handled separately.

COMPANY CONTEXT (JSON):
`;

const WHATIF_SYSTEM_PROMPT_HEADER = `You are the CarbonWise Assistant, a grounded sustainability chatbot.

A "what if" scenario has ALREADY been calculated by the existing What-if Engine. Your ONLY job is to explain the result below in 1-3 plain-English sentences.

RULES (follow strictly):
1. Use ONLY the numbers in the JSON result below. Do NOT recalculate, estimate, or invent any number.
2. If the JSON shows no modifications were resolved, reply with EXACTLY: "I don't have enough data to answer this question."
3. Be concise and mention both the CO2e change and the cost change if present.

WHAT-IF RESULT (JSON):
`;

function buildGeneralContextJSON(context) {
    return JSON.stringify(
        {
            companyProfile: context.companyProfile,
            currency: context.currency,
            period: context.period,
            emissionSummary: context.emissionSummary,
            scopeBreakdown: context.scopeBreakdown,
            costSummary: context.costSummary,
            topEmissionSources: context.topEmissionSources,
            topCostDrivers: context.topCostDrivers,
            recommendations: context.recommendations,
            actionPlan: context.actionPlan,
        },
        null,
        2
    );
}

async function llmGeneralAnswer(context, message) {
    const system = GENERAL_SYSTEM_PROMPT_HEADER + buildGeneralContextJSON(context);
    const text = await askLLM({ system, userMessage: message });
    return text;
}

async function llmWhatIfAnswer(context, message, detected) {
    if (!detected || detected.modifications.length === 0) {
        return NO_DATA_ANSWER;
    }
    const result = runWhatIf({ companyId: context.companyProfile.id, modifications: detected.modifications });
    const resultSummary = {
        modifications: detected.modifications,
        beforeTotalCo2eKg: round2(result.baselineFootprint.totalCo2eKg),
        afterTotalCo2eKg: round2(result.footprint.totalCo2eKg),
        co2eSavedKg: round2(result.baselineFootprint.totalCo2eKg - result.footprint.totalCo2eKg),
        beforeAnnualizedCostEGP: round2(result.baselineCosts.annualizedCostEGP),
        afterAnnualizedCostEGP: round2(result.costs.annualizedCostEGP),
        annualCostSavedEGP: round2(result.baselineCosts.annualizedCostEGP - result.costs.annualizedCostEGP),
    };
    const system = WHATIF_SYSTEM_PROMPT_HEADER + JSON.stringify(resultSummary, null, 2);
    const text = await askLLM({ system, userMessage: message });
    return text;
}

function round2(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------
/**
 * @param {object} context - output of contextBuilder.buildChatContext()
 * @param {string} message - the user's raw question
 * @returns {Promise<{answer: string, intent: string|null, source: "llm"|"template"}>}
 */
async function answerQuestion(context, message) {
    if (!context || !context.hasData) {
        return { answer: NO_DATA_ANSWER, intent: null, source: "template" };
    }

    const whatIf = isWhatIfQuestion(message);

    if (isConfigured()) {
        try {
            if (whatIf) {
                const detected = detectWhatIf(message, context.activityTypesPresent);
                const answer = await llmWhatIfAnswer(context, message, detected);
                return { answer, intent: "whatif", source: "llm" };
            }
            const answer = await llmGeneralAnswer(context, message);
            return { answer, intent: classifyIntent(message), source: "llm" };
        } catch (err) {
            // LLM unavailable/erroring - fall through to the deterministic
            // grounded engine below so the chatbot still works and still
            // never hallucinates.
            console.error("[chat] LLM call failed, falling back to template engine:", err.message);
        }
    }

    if (whatIf) {
        const { answer, intent } = deterministicWhatIfAnswer(context, message);
        return { answer, intent, source: "template" };
    }
    const { answer, intent } = deterministicGeneralAnswer(context, message);
    return { answer, intent, source: "template" };
}

module.exports = { answerQuestion, classifyIntent, NO_DATA_ANSWER, UNRECOGNIZED_ANSWER };
