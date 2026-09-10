// backend/src/engine/calculateEmissions.js
// Task T4 (Tasneem) — calculateEmissions()
// Task T5 (Tasneem) — calculateCompanyFootprint()
// See CarbonWise Implementation Plan, Section 2.1 and 2.3
//
// Formula (Section 2.1):
//   CO2e (kg) = Activity Quantity (in the factor's unit) x Emission Factor (kg CO2e per unit)

const { mapToScope } = require("./mapToScope");

// Some parts of the system (e.g. Nourhan's sample_company.json) refer to
// activities using a shorter "type" string than the canonical
// emission_factors.json "id" field. This table resolves those aliases to
// the correct factor id. If an activity already uses a canonical id
// (e.g. "fuel_diesel", "transport_rail_national") no alias lookup is needed.
const ACTIVITY_TYPE_TO_FACTOR_ID = {
    electricity: "elec_uk_grid",
    natural_gas: "fuel_natural_gas",
    business_travel_car: "transport_car_petrol_avg", // default to petrol; pass an explicit factor_id on the activity to use diesel instead
    business_travel_rail: "transport_rail_national",
    business_travel_flight: "transport_flight_domestic",
    waste_landfill: "waste_landfill_mixed",
    waste_recycled: "waste_recycled_mixed",
};

function resolveFactorId(activity) {
    // An activity can explicitly name its factor (factor_id) — this always wins.
    if (activity.factor_id) return activity.factor_id;
    if (ACTIVITY_TYPE_TO_FACTOR_ID[activity.type]) return ACTIVITY_TYPE_TO_FACTOR_ID[activity.type];
    // Otherwise assume activity.type IS already the canonical factor id
    // (e.g. "fuel_diesel", "transport_car_petrol_avg").
    return activity.type;
}

/**
 * Calculates CO2e for a single activity record.
 * @param {{type: string, quantity: number, unit?: string, date?: string, factor_id?: string}} activity
 * @param {Array<object>} factors - loaded from emission_factors.json
 * @returns {{co2e_kg: number, scope: string, factor_used_id: string, type: string, date: string}}
 */
function calculateEmissions(activity, factors) {
    if (typeof activity.quantity !== "number" || Number.isNaN(activity.quantity)) {
        throw new Error(`Invalid quantity for activity type "${activity.type}": ${activity.quantity}`);
    }

    const factorId = resolveFactorId(activity);
    const factor = factors.find((f) => f.id === factorId);
    if (!factor) {
        throw new Error(`No emission factor found for type: ${activity.type}`);
    }

    const co2e_kg = activity.quantity * factor.factor_kgco2e;
    const scope = mapToScope(activity.type);

    return {
        ...activity,
        co2e_kg,
        scope,
        factor_used_id: factor.id,
    };
}

/**
 * Aggregates a full company's already-calculated activities into a footprint summary.
 * @param {Array<object>} calculatedActivities - output of calculateEmissions(), one per activity
 * @returns {{totalCo2eKg: number, byScope: object, byCategory: object, byMonth: object}}
 */
function calculateCompanyFootprint(calculatedActivities) {
    const byScope = { "Scope 1": 0, "Scope 2": 0, "Scope 3": 0 };
    const byCategory = {};
    const byMonth = {};

    for (const a of calculatedActivities) {
        byScope[a.scope] = (byScope[a.scope] || 0) + a.co2e_kg;
        byCategory[a.type] = (byCategory[a.type] || 0) + a.co2e_kg;

        if (a.date) {
            const month = a.date.slice(0, 7); // "2026-01"
            byMonth[month] = (byMonth[month] || 0) + a.co2e_kg;
        }
    }

    const totalCo2eKg = Object.values(byScope).reduce((sum, v) => sum + v, 0);

    return { totalCo2eKg, byScope, byCategory, byMonth };
}

module.exports = { calculateEmissions, calculateCompanyFootprint, ACTIVITY_TYPE_TO_FACTOR_ID };
