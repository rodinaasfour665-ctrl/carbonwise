// backend/src/recommendations/recommendationEngine.js
// Feature 2 — Dynamic Recommendations
//
// Combines a company's actual footprint (calculateCompanyFootprint, T5),
// actual costs (costEngine.computeCosts, Feature 1) and actual employee
// count with the assumption set in recommendationLibrary.js to produce
// recommendations whose CO2 reduction, savings, implementation cost,
// payback and priority are all calculated from that company's real data —
// nothing here is a hardcoded final business result.
//
// Priority formula (agreed):
//   40% emissions reduction + 30% annual savings + 15% implementation
//   cost (lower is better) + 10% difficulty (lower is better) + 5%
//   payback period (shorter is better)
// Each component is min-max normalized to [0, 1] ACROSS the recommendations
// generated for this company (so "highest emissions reduction" always
// scores 1 regardless of the company's absolute size), then combined with
// the weights above into a 0-100 priorityScore.

const { getLibraryEntry } = require("./recommendationLibrary");

function computeImplementationCost(model, { employees, currentAnnualCostEGP }) {
    if (!model) return 0;
    switch (model.type) {
        case "per_employee":
            // Falls back to a scale of 1 if employee count is unknown, rather
            // than silently returning 0 (which would misleadingly read as
            // "free"). Documented assumption, not a hardcoded result.
            return (employees && employees > 0 ? employees : 1) * model.rate;
        case "pct_of_annual_cost":
            return currentAnnualCostEGP * model.pct;
        case "flat":
        default:
            return model.amount || 0;
    }
}

function effortLabelForDifficulty(difficulty) {
    if (difficulty <= 2) return "low";
    if (difficulty <= 3) return "medium";
    return "high";
}

// min-max normalize `value` against the full set `values`. `invert` flips
// the scale for "lower is better" metrics (implementation cost, difficulty,
// payback) so higher normalized score always means "more favorable".
function normalize(value, values, invert = false) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (max === min) return 1; // every candidate ties on this dimension - no discrimination, full credit for all
    const n = (value - min) / (max - min);
    return invert ? 1 - n : n;
}

/**
 * @param {{byCategory: object}} footprint - output of calculateCompanyFootprint() (T5)
 * @param {object} costs - output of costEngine.computeCosts()
 * @param {{employees?: number}} company
 * @returns {Array<object>} recommendations sorted by priorityScore descending
 */
function generateRecommendations({ footprint, costs, company }) {
    const byCategory = (footprint && footprint.byCategory) || {};
    const annualizationFactor = (costs && costs.period && costs.period.annualizationFactor) || 1;
    const annualizedCostByActivityType = (costs && costs.annualizedCostByActivityType) || {};
    const employees = company && typeof company.employees === "number" && company.employees > 0
        ? company.employees
        : null;

    // Only relevant categories: the ones the company actually has positive
    // emissions in right now (matches the original rankRecommendations.js
    // behavior — a company with no waste activities gets no waste
    // recommendation).
    const candidates = Object.entries(byCategory)
        .filter(([, co2eKg]) => co2eKg > 0)
        .map(([type, co2eKg]) => {
            const entry = getLibraryEntry(type);
            const title = typeof entry.title === "function" ? entry.title(type) : entry.title;

            const currentAnnualCo2eKg = co2eKg * annualizationFactor;
            const co2ReductionKg = currentAnnualCo2eKg * entry.quantityReductionPct;

            const currentAnnualCostEGP = annualizedCostByActivityType[type] || 0;
            const annualSavingsEGP = currentAnnualCostEGP * entry.quantityReductionPct;

            const implementationCostEGP = computeImplementationCost(entry.implementationCostModel, {
                employees,
                currentAnnualCostEGP,
            });

            // Spec: if savings <= 0, payback = null (not Infinity/0/negative).
            const paybackYears = annualSavingsEGP > 0 ? implementationCostEGP / annualSavingsEGP : null;

            return {
                type,
                action: title,
                category: type,
                difficulty: entry.difficulty,
                effort: effortLabelForDifficulty(entry.difficulty),
                reductionPct: entry.quantityReductionPct,
                currentAnnualCo2eKg,
                co2ReductionKg,
                estimatedReductionKg: co2ReductionKg, // kept for the existing RecommendationCard.jsx field name
                currentAnnualCostEGP,
                annualSavingsEGP,
                implementationCostEGP,
                paybackYears,
            };
        });

    if (candidates.length === 0) return [];

    const emissionsVals = candidates.map((c) => c.co2ReductionKg);
    const savingsVals = candidates.map((c) => c.annualSavingsEGP);
    const implCostVals = candidates.map((c) => c.implementationCostEGP);
    const difficultyVals = candidates.map((c) => c.difficulty);
    const paybackVals = candidates.filter((c) => c.paybackYears !== null).map((c) => c.paybackYears);

    for (const c of candidates) {
        const emissionsScore = normalize(c.co2ReductionKg, emissionsVals, false);
        const savingsScore = normalize(c.annualSavingsEGP, savingsVals, false);
        const implCostScore = normalize(c.implementationCostEGP, implCostVals, true);
        const difficultyScore = normalize(c.difficulty, difficultyVals, true);
        const paybackScore =
            c.paybackYears === null
                ? 0
                : paybackVals.length > 0
                ? normalize(c.paybackYears, paybackVals, true)
                : 0;

        const priorityScore =
            (0.4 * emissionsScore +
                0.3 * savingsScore +
                0.15 * implCostScore +
                0.1 * difficultyScore +
                0.05 * paybackScore) *
            100;

        c.priorityScore = Math.round(priorityScore * 10) / 10;
        c.scoreBreakdown = {
            emissionsScore: round4(emissionsScore),
            savingsScore: round4(savingsScore),
            implementationCostScore: round4(implCostScore),
            difficultyScore: round4(difficultyScore),
            paybackScore: round4(paybackScore),
        };
    }

    candidates.sort((a, b) => b.priorityScore - a.priorityScore);
    return candidates;
}

function round4(n) {
    return Math.round(n * 10000) / 10000;
}

module.exports = { generateRecommendations, computeImplementationCost, effortLabelForDifficulty };
