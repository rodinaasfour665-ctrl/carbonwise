// backend/src/recommendations/personalization.js
// Feature: Recommendation Personalization
//
// Does NOT recompute emissions, costs, or priorityScore — those come from
// calculateCompanyFootprint() (T5), costEngine.computeCosts() (Feature 1)
// and recommendationEngine.generateRecommendations() (Feature 2) exactly
// as they already run for GET /api/recommendations. This module only
// reads the numbers those already produced and layers a
// company-profile-aware relevance signal on top, so a candidate that
// matches THIS company's actual major emission source and/or major cost
// driver is marked/ranked as more relevant than one that doesn't.
//
// "Major" is a share-of-total judgment computed from the company's own
// real, already-calculated numbers (currentAnnualCo2eKg / currentAnnualCostEGP
// on each candidate, which recommendationEngine.js derives from that
// company's stored activities) — never an invented number and never a
// hardcoded category name. A company where diesel is a large share of
// emissions/cost will see diesel actions treated as major; one where it's
// negligible will not, regardless of what category that happens to be.

// Anything at or above this share of the company's TOTAL (across all of
// its current recommendation candidates) counts as "major" for that
// dimension. 25% is a simple, symmetric threshold: with 4 candidates every
// one would be exactly "average" at 25%, so a candidate needs a
// meaningfully larger-than-even share of the company's own footprint/cost
// to qualify - not just an arbitrary fixed kg or EGP amount.
const MAJOR_SHARE_THRESHOLD = 0.25;

// Relative weight of "this is a major emission source" vs "this is a
// major cost driver" inside the personalization score itself. Emissions
// weighted higher because CarbonWise's stated purpose is cutting CO2e;
// cost is a secondary (but real) driver of what a company will actually
// act on.
const EMISSION_SHARE_WEIGHT = 0.6;
const COST_SHARE_WEIGHT = 0.4;

// How much the personalization score is allowed to move the engine's own
// priorityScore when producing the Action Plan's ranking. priorityScore
// keeps the majority weight since it already encodes emissions/savings/
// cost/difficulty/payback (Feature 2's own 40/30/15/10/5 formula);
// personalization is a company-profile-aware adjustment on top, not a
// replacement.
const PRIORITY_WEIGHT_IN_COMBINED_SCORE = 0.7;
const PERSONALIZATION_WEIGHT_IN_COMBINED_SCORE = 0.3;

function round1(n) {
    return Math.round(n * 10) / 10;
}

/**
 * @param {Array<object>} recommendations - output of generateRecommendations()
 * @param {{employees?: number, sector?: string, name?: string}} company - real row from the companies table
 * @returns {Array<object>} same recommendations, each with personalization fields added:
 *   emissionSharePct, costSharePct, isMajorEmissionSource, isMajorCostDriver,
 *   personalizationScore (0-100), combinedScore (0-100, used to rank the Action Plan)
 */
function personalizeRecommendations(recommendations, company = {}) {
    if (!Array.isArray(recommendations) || recommendations.length === 0) return [];

    // Totals across THIS company's own current candidates only - i.e. the
    // categories it actually has activity in right now (generateRecommendations
    // already filters out categories with zero emissions). A candidate's
    // share is therefore always relative to this company's own footprint/
    // cost, never to some fixed or cross-company baseline.
    const totalAnnualCo2eKg = recommendations.reduce((sum, r) => sum + (r.currentAnnualCo2eKg || 0), 0);
    const totalAnnualCostEGP = recommendations.reduce((sum, r) => sum + (r.currentAnnualCostEGP || 0), 0);

    return recommendations.map((r) => {
        const emissionShare = totalAnnualCo2eKg > 0 ? r.currentAnnualCo2eKg / totalAnnualCo2eKg : 0;
        // Categories outside the Cost Engine's scope (e.g. business travel,
        // natural gas - see pricingDefaults.js) have currentAnnualCostEGP = 0
        // for every candidate, so costShare correctly comes out to 0 rather
        // than a misleading divide-by-zero share.
        const costShare = totalAnnualCostEGP > 0 ? r.currentAnnualCostEGP / totalAnnualCostEGP : 0;

        const isMajorEmissionSource = emissionShare >= MAJOR_SHARE_THRESHOLD;
        const isMajorCostDriver = costShare >= MAJOR_SHARE_THRESHOLD;

        const personalizationScore = round1(
            (EMISSION_SHARE_WEIGHT * emissionShare + COST_SHARE_WEIGHT * costShare) * 100
        );

        const combinedScore = round1(
            PRIORITY_WEIGHT_IN_COMBINED_SCORE * (r.priorityScore || 0) +
                PERSONALIZATION_WEIGHT_IN_COMBINED_SCORE * personalizationScore
        );

        return {
            ...r,
            emissionSharePct: round1(emissionShare * 100),
            costSharePct: round1(costShare * 100),
            isMajorEmissionSource,
            isMajorCostDriver,
            personalizationScore,
            combinedScore,
        };
    });
}

module.exports = {
    personalizeRecommendations,
    MAJOR_SHARE_THRESHOLD,
};
