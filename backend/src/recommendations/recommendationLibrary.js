// backend/src/recommendations/recommendationLibrary.js
// Feature 2 — Dynamic Recommendations: reusable action library
//
// One entry per activity "type" (same strings as calculateEmissions.js /
// mapToScope.js / the `activities` table). Each entry is an ASSUMPTION set
// (an achievable reduction %, a difficulty rating, an implementation-cost
// model) — the same role emission_factors.json/plausible_ranges.json play
// for the emissions engine: fixed inputs that get combined with a
// specific company's actual data at request time. None of these numbers
// is itself a final recommendation result; recommendationEngine.js always
// multiplies them against that company's real emissions/cost/employees.
//
// quantityReductionPct: the fraction of that activity type's current
// quantity a company could realistically cut by taking the action. Since
// both CO2e (quantity x emission factor) and cost (quantity x price) are
// linear in quantity, this single percentage drives both the CO2 and the
// EGP savings estimate consistently.
//
// difficulty: 1 (easiest) - 5 (hardest) — feeds the priority formula's
// 10% difficulty weight.
//
// implementationCostModel: how implementationCostEGP is computed for a
// specific company —
//   { type: "per_employee", rate }         -> rate (EGP) x company.employees
//   { type: "pct_of_annual_cost", pct }     -> pct x that type's own annualized EGP cost
//   { type: "flat", amount }                -> a fixed EGP figure (e.g. 0 for a pure policy/behavior change)

const RECOMMENDATION_LIBRARY = {
    electricity: {
        title: "Audit lighting and switch to LED / efficient equipment",
        quantityReductionPct: 0.15,
        difficulty: 2,
        implementationCostModel: { type: "per_employee", rate: 250 },
    },
    elec_uk_grid: {
        title: "Audit lighting and switch to LED / efficient equipment",
        quantityReductionPct: 0.15,
        difficulty: 2,
        implementationCostModel: { type: "per_employee", rate: 250 },
    },

    fuel_diesel: {
        title: "Optimize diesel vehicle/equipment routes and maintenance; explore hybrid or electric alternatives",
        quantityReductionPct: 0.15,
        difficulty: 4,
        implementationCostModel: { type: "pct_of_annual_cost", pct: 0.5 },
    },
    fuel_petrol: {
        title: "Optimize petrol vehicle usage and maintenance; explore hybrid or electric alternatives",
        quantityReductionPct: 0.15,
        difficulty: 4,
        implementationCostModel: { type: "pct_of_annual_cost", pct: 0.5 },
    },

    fuel_natural_gas: {
        title: "Improve building insulation and heating system efficiency",
        quantityReductionPct: 0.15,
        difficulty: 3,
        implementationCostModel: { type: "per_employee", rate: 150 },
    },
    natural_gas: {
        title: "Improve building insulation and heating system efficiency",
        quantityReductionPct: 0.15,
        difficulty: 3,
        implementationCostModel: { type: "per_employee", rate: 150 },
    },

    transport_car_petrol_avg: {
        title: "Shift business travel from cars to rail or public transport where practical",
        quantityReductionPct: 0.3,
        difficulty: 1,
        implementationCostModel: { type: "flat", amount: 0 },
    },
    transport_car_diesel_avg: {
        title: "Shift business travel from cars to rail or public transport where practical",
        quantityReductionPct: 0.3,
        difficulty: 1,
        implementationCostModel: { type: "flat", amount: 0 },
    },
    business_travel_car: {
        title: "Shift business travel from cars to rail or public transport where practical",
        quantityReductionPct: 0.3,
        difficulty: 1,
        implementationCostModel: { type: "flat", amount: 0 },
    },

    transport_rail_national: {
        title: "Consolidate rail trips and book in advance to fill more seats per trip",
        quantityReductionPct: 0.1,
        difficulty: 1,
        implementationCostModel: { type: "flat", amount: 0 },
    },
    business_travel_rail: {
        title: "Consolidate rail trips and book in advance to fill more seats per trip",
        quantityReductionPct: 0.1,
        difficulty: 1,
        implementationCostModel: { type: "flat", amount: 0 },
    },

    transport_flight_domestic: {
        title: "Replace domestic flights with rail for business travel where feasible",
        quantityReductionPct: 0.4,
        difficulty: 1,
        implementationCostModel: { type: "flat", amount: 0 },
    },
    business_travel_flight: {
        title: "Replace domestic flights with rail for business travel where feasible",
        quantityReductionPct: 0.4,
        difficulty: 1,
        implementationCostModel: { type: "flat", amount: 0 },
    },

    waste_landfill_mixed: {
        title: "Increase recycling / diversion rate to cut landfill waste volume",
        quantityReductionPct: 0.25,
        difficulty: 2,
        implementationCostModel: { type: "per_employee", rate: 50 },
    },
    waste_landfill: {
        title: "Increase recycling / diversion rate to cut landfill waste volume",
        quantityReductionPct: 0.25,
        difficulty: 2,
        implementationCostModel: { type: "per_employee", rate: 50 },
    },
    waste_recycled_mixed: {
        title: "Explore closed-loop recycling partnerships to cut residual waste emissions further",
        quantityReductionPct: 0.1,
        difficulty: 2,
        implementationCostModel: { type: "per_employee", rate: 30 },
    },
    waste_recycled: {
        title: "Explore closed-loop recycling partnerships to cut residual waste emissions further",
        quantityReductionPct: 0.1,
        difficulty: 2,
        implementationCostModel: { type: "per_employee", rate: 30 },
    },
};

const DEFAULT_RECOMMENDATION = {
    title: (type) => `Review and reduce "${type.replaceAll("_", " ")}" activity`,
    quantityReductionPct: 0.1,
    difficulty: 3,
    implementationCostModel: { type: "flat", amount: 0 },
};

function getLibraryEntry(activityType) {
    return RECOMMENDATION_LIBRARY[activityType] || DEFAULT_RECOMMENDATION;
}

module.exports = { RECOMMENDATION_LIBRARY, DEFAULT_RECOMMENDATION, getLibraryEntry };
