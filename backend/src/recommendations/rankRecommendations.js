// backend/src/recommendations/rankRecommendations.js
// Task R6 (Rodina) — ORIGINAL static version, kept for reference/backward
// compatibility. SUPERSEDED by recommendationEngine.js's
// generateRecommendations(), which routes/recommendations.js now calls
// instead: that version prices in the company's actual costs, employees,
// and the agreed 40/30/15/10/5 priority formula (CO2 reduction, annual
// EGP savings, implementation cost, difficulty, payback), rather than
// ranking by raw category emissions alone. This file is unchanged and
// unused by any route — nothing that depended on it breaks.
//
// Ranking rule: ranked strictly by each category's current byCategory
// emissions, largest first - so the top recommendation always targets
// whichever activity type is the company's single biggest emissions
// hotspot (per the plan's R6 test). estimatedReductionKg is a rough,
// hackathon-scope estimate (category emissions x an assumed achievable
// reduction %) for that action, not the ranking key itself.

// Action library keyed by activity "type" as used in emission_factors.json /
// mapToScope.js / calculateEmissions.js's alias table. `reductionPct` is a
// simple assumed achievable reduction, not a cited figure.
const ACTION_LIBRARY = {
    elec_uk_grid: { action: "Switch to a renewable electricity tariff and audit lighting/equipment for efficiency upgrades", reductionPct: 0.2, effort: "medium" },
    electricity: { action: "Switch to a renewable electricity tariff and audit lighting/equipment for efficiency upgrades", reductionPct: 0.2, effort: "medium" },

    fuel_diesel: { action: "Transition diesel vehicles/equipment to electric or hybrid alternatives", reductionPct: 0.15, effort: "high" },
    fuel_petrol: { action: "Transition petrol vehicles to electric or hybrid alternatives", reductionPct: 0.15, effort: "high" },
    fuel_natural_gas: { action: "Improve building insulation and heating system efficiency", reductionPct: 0.15, effort: "medium" },
    natural_gas: { action: "Improve building insulation and heating system efficiency", reductionPct: 0.15, effort: "medium" },

    transport_car_petrol_avg: { action: "Shift business travel from cars to rail where practical", reductionPct: 0.3, effort: "low" },
    transport_car_diesel_avg: { action: "Shift business travel from cars to rail where practical", reductionPct: 0.3, effort: "low" },
    business_travel_car: { action: "Shift business travel from cars to rail where practical", reductionPct: 0.3, effort: "low" },
    transport_rail_national: { action: "Consolidate rail trips and encourage advance booking for fuller trains", reductionPct: 0.1, effort: "low" },
    transport_flight_domestic: { action: "Replace domestic flights with rail for business travel where feasible", reductionPct: 0.4, effort: "low" },
    business_travel_flight: { action: "Replace domestic flights with rail for business travel where feasible", reductionPct: 0.4, effort: "low" },
    business_travel_rail: { action: "Consolidate rail trips and encourage advance booking for fuller trains", reductionPct: 0.1, effort: "low" },

    waste_landfill_mixed: { action: "Increase recycling/diversion rate to cut landfill waste volume", reductionPct: 0.25, effort: "low" },
    waste_landfill: { action: "Increase recycling/diversion rate to cut landfill waste volume", reductionPct: 0.25, effort: "low" },
    waste_recycled_mixed: { action: "Explore closed-loop recycling partnerships to further cut residual waste emissions", reductionPct: 0.1, effort: "low" },
    waste_recycled: { action: "Explore closed-loop recycling partnerships to further cut residual waste emissions", reductionPct: 0.1, effort: "low" },
};

const DEFAULT_ACTION = { action: (category) => `Review and reduce "${category}" activity`, reductionPct: 0.1, effort: "medium" };

/**
 * @param {{byCategory: object}} footprint - output of calculateCompanyFootprint() (T5)
 * @returns {Array<{action: string, category: string, categoryCo2eKg: number, estimatedReductionKg: number, effort: string}>}
 *          sorted descending by categoryCo2eKg (largest emissions hotspot first)
 */
function rankRecommendations(footprint) {
    const byCategory = (footprint && footprint.byCategory) || {};

    return Object.entries(byCategory)
        .filter(([, co2eKg]) => co2eKg > 0)
        .sort(([, a], [, b]) => b - a)
        .map(([category, co2eKg]) => {
            const entry = ACTION_LIBRARY[category] || DEFAULT_ACTION;
            const action = typeof entry.action === "function" ? entry.action(category) : entry.action;
            return {
                action,
                category,
                categoryCo2eKg: co2eKg,
                estimatedReductionKg: co2eKg * entry.reductionPct,
                effort: entry.effort,
            };
        });
}

module.exports = { rankRecommendations, ACTION_LIBRARY };
