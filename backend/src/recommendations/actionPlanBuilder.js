// backend/src/recommendations/actionPlanBuilder.js
// Feature: Dynamic Action Plan
//
// Pure function, no DB/Express here (same separation costEngine.js keeps
// from routes/costs.js). Takes recommendations that have ALREADY been
// produced by recommendationEngine.generateRecommendations() (Feature 2)
// and personalization.personalizeRecommendations() - it does not
// recalculate CO2e, EGP costs/savings, or priorityScore. It only:
//   1. buckets each recommendation into a timeline, derived from that
//      recommendation's own difficulty + paybackYears (never a hardcoded
//      per-category timeline), and
//   2. reshapes the fields into the Action Plan's response shape.

// A recommendation with low implementation difficulty (1-2 on the 1-5
// scale recommendationLibrary.js assigns) AND either no meaningful payback
// hurdle (paybackYears === null, i.e. it's cost-free/behavioral) or a
// payback inside a year is something a company could realistically start
// and see returns on within a single quarter-to-quarter planning cycle.
const QUICK_WIN_MAX_DIFFICULTY = 2;
const QUICK_WIN_MAX_PAYBACK_YEARS = 1;

// A recommendation that is either hard to implement (difficulty 4-5,
// e.g. vehicle fleet or building-envelope changes) OR takes more than 3
// years to pay for itself needs a multi-year capital-planning horizon.
const LONG_TERM_MIN_DIFFICULTY = 4;
const LONG_TERM_MIN_PAYBACK_YEARS = 3;

function assignTimeline({ difficulty, paybackYears }) {
    const isQuickWin =
        difficulty <= QUICK_WIN_MAX_DIFFICULTY &&
        (paybackYears === null || paybackYears <= QUICK_WIN_MAX_PAYBACK_YEARS);
    if (isQuickWin) return "quick_wins";

    const isLongTerm =
        difficulty >= LONG_TERM_MIN_DIFFICULTY ||
        (paybackYears !== null && paybackYears > LONG_TERM_MIN_PAYBACK_YEARS);
    if (isLongTerm) return "long_term";

    return "medium_term";
}

const TIMELINE_META = {
    quick_wins: { label: "Quick Wins", horizon: "0-3 months" },
    medium_term: { label: "Medium Term", horizon: "3-12 months" },
    long_term: { label: "Long Term", horizon: "1-5 years" },
};

function round1(n) {
    return n === null || n === undefined ? null : Math.round(n * 10) / 10;
}

/**
 * @param {Array<object>} personalizedRecommendations - output of personalizeRecommendations()
 * @returns {{quickWins: object[], mediumTerm: object[], longTerm: object[], timelineDefinitions: object}}
 */
function buildActionPlan(personalizedRecommendations) {
    const buckets = { quick_wins: [], medium_term: [], long_term: [] };

    for (const r of personalizedRecommendations) {
        const timelineKey = assignTimeline(r);
        const paybackMonths = r.paybackYears === null ? null : round1(r.paybackYears * 12);

        buckets[timelineKey].push({
            recommendationId: r.type,
            title: r.action,
            category: r.category,
            timeline: TIMELINE_META[timelineKey].label,
            priorityScore: r.priorityScore,
            personalizationScore: r.personalizationScore,
            combinedScore: r.combinedScore,
            isMajorEmissionSource: r.isMajorEmissionSource,
            isMajorCostDriver: r.isMajorCostDriver,
            emissionSharePct: r.emissionSharePct,
            costSharePct: r.costSharePct,
            co2ReductionKg: round1(r.co2ReductionKg),
            annualSavingsEGP: round1(r.annualSavingsEGP),
            implementationCostEGP: round1(r.implementationCostEGP),
            paybackYears: round1(r.paybackYears),
            paybackMonths,
            difficulty: r.difficulty,
            effort: r.effort,
        });
    }

    for (const key of Object.keys(buckets)) {
        buckets[key].sort((a, b) => b.combinedScore - a.combinedScore);
    }

    return {
        quickWins: buckets.quick_wins,
        mediumTerm: buckets.medium_term,
        longTerm: buckets.long_term,
        timelineDefinitions: TIMELINE_META,
    };
}

module.exports = { buildActionPlan, assignTimeline, TIMELINE_META };
