// backend/src/chat/contextBuilder.js
// Grounded Sustainability Chatbot — Context Builder
//
// Builds ONE structured, company-specific context object using the SAME
// engines routes/dashboard.js already calls (calculateCompanyFootprint,
// computeCosts, generateRecommendations, personalizeRecommendations,
// buildActionPlan). Nothing here is calculated independently — this only
// re-shapes existing engine output into a small, chat-friendly context, per
// the spec: "Do not send unnecessary database data to the model."

const {
    getResultsByCompany,
    getActivitiesByCompany,
    getCompanyById,
    getCostPricingByCompany,
} = require("../db/db");
const { calculateCompanyFootprint } = require("../engine/calculateEmissions");
const { computeCosts } = require("../costs/costEngine");
const { generateRecommendations } = require("../recommendations/recommendationEngine");
const { personalizeRecommendations } = require("../recommendations/personalization");
const { buildActionPlan } = require("../recommendations/actionPlanBuilder");

// Same top-N helper as routes/dashboard.js (kept local so this module has
// no dependency on the dashboard route).
function topEntries(obj = {}, limit = 5) {
    return Object.entries(obj)
        .map(([key, value]) => ({ key, value: Number(value || 0) }))
        .filter((e) => e.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, limit);
}

/**
 * Builds the full grounded chatbot context for one company.
 * Returns null if the company doesn't exist (caller returns 404).
 * @param {number|string} companyId
 */
function buildChatContext(companyId) {
    const company = getCompanyById(companyId);
    if (!company) return null;

    const rows = getResultsByCompany(companyId);
    const activities = getActivitiesByCompany(companyId);
    const pricingOverrides = getCostPricingByCompany(companyId);

    // --- Emissions: identical pipeline to routes/results.js / dashboard.js ---
    const calculatedActivities = rows
        .filter((r) => r.co2e_kg !== null && r.co2e_kg !== undefined)
        .map((r) => ({ type: r.type, date: r.date, co2e_kg: r.co2e_kg, scope: r.scope }));
    const footprint = calculateCompanyFootprint(calculatedActivities);

    // --- Costs: identical pipeline to routes/costs.js ---
    const costs = computeCosts({ activities, pricingOverrides, company });

    // --- Recommendations + Personalization + Action Plan: identical
    //     pipeline to routes/recommendations.js / routes/actionPlan.js ---
    const recommendations = generateRecommendations({ footprint, costs, company });
    const personalized = personalizeRecommendations(recommendations, company);
    const plan = buildActionPlan(personalized);

    const employees =
        company && typeof company.employees === "number" && company.employees > 0
            ? company.employees
            : null;

    return {
        hasData: activities.length > 0,
        companyProfile: {
            id: company.id,
            name: company.name,
            sector: company.sector,
            employees: company.employees,
            location: company.location,
        },
        currency: "EGP",
        period: costs.period,
        activityCount: activities.length,
        emissionSummary: {
            totalCo2eKg: round2(footprint.totalCo2eKg),
            co2ePerEmployeeKg: employees ? round2(footprint.totalCo2eKg / employees) : null,
        },
        scopeBreakdown: mapValues(footprint.byScope, round2),
        costSummary: {
            observedCostEGP: round2(costs.observedCostEGP),
            annualizedCostEGP: round2(costs.annualizedCostEGP),
            costPerEmployeeEGP: costs.costPerEmployeeEGP !== null ? round2(costs.costPerEmployeeEGP) : null,
        },
        topEmissionSources: topEntries(footprint.byCategory, 5).map((e) => ({ ...e, value: round2(e.value) })),
        topCostDrivers: topEntries(costs.annualizedCostByActivityType, 5).map((e) => ({ ...e, value: round2(e.value) })),
        recommendations: recommendations.map((r) => ({
            type: r.type,
            action: r.action,
            category: r.category,
            priorityScore: r.priorityScore,
            co2ReductionKg: round2(r.co2ReductionKg),
            annualSavingsEGP: round2(r.annualSavingsEGP),
            implementationCostEGP: round2(r.implementationCostEGP),
            paybackYears: r.paybackYears !== null ? round2(r.paybackYears) : null,
            difficulty: r.difficulty,
            effort: r.effort,
        })),
        actionPlan: {
            quickWins: plan.quickWins,
            mediumTerm: plan.mediumTerm,
            longTerm: plan.longTerm,
        },
        // Used by whatifDetector.js: a natural-language category keyword
        // ("diesel", "electricity", ...) only ever resolves to a type that
        // ACTUALLY exists in this company's stored activities — never
        // invented.
        activityTypesPresent: [...new Set(activities.map((a) => a.type))],
    };
}

function round2(n) {
    if (n === null || n === undefined || !Number.isFinite(n)) return n;
    return Math.round(n * 100) / 100;
}

function mapValues(obj, fn) {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = fn(v);
    return out;
}

module.exports = { buildChatContext, topEntries };
