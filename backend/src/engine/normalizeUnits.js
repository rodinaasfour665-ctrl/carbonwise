// backend/src/engine/normalizeUnits.js
// Task T6 (Tasneem) — Operation 1: Unit normalization
// See CarbonWise Implementation Plan, Section 1.5, Operation 1
//
// Converts an incoming activity's quantity into the canonical unit used
// throughout the rest of the system (and by emission_factors.json), so
// calculateEmissions.js never has to deal with mixed units.
//
// Example (from the plan):
//   Input:  { type: "waste_landfill", quantity: 2, unit: "tonne" }
//   Output: { type: "waste_landfill", quantity: 2000, unit: "kg" }

// Each entry: { <accepted unit string, lowercased> : { canonical: <target unit>, factor: <multiply quantity by this> } }
const UNIT_CONVERSIONS = {
    // --- Mass -> kg ---
    "g": { canonical: "kg", factor: 0.001 },
    "gram": { canonical: "kg", factor: 0.001 },
    "grams": { canonical: "kg", factor: 0.001 },
    "kg": { canonical: "kg", factor: 1 },
    "kilogram": { canonical: "kg", factor: 1 },
    "kilograms": { canonical: "kg", factor: 1 },
    "tonne": { canonical: "kg", factor: 1000 },
    "tonnes": { canonical: "kg", factor: 1000 },
    "t": { canonical: "kg", factor: 1000 },

    // --- Volume -> litre ---
    "ml": { canonical: "litre", factor: 0.001 },
    "millilitre": { canonical: "litre", factor: 0.001 },
    "l": { canonical: "litre", factor: 1 },
    "litre": { canonical: "litre", factor: 1 },
    "litres": { canonical: "litre", factor: 1 },
    "liter": { canonical: "litre", factor: 1 },
    "liters": { canonical: "litre", factor: 1 },

    // --- Energy -> kWh ---
    "wh": { canonical: "kWh", factor: 0.001 },
    "kwh": { canonical: "kWh", factor: 1 },
    "mwh": { canonical: "kWh", factor: 1000 },

    // --- Distance -> km ---
    "m": { canonical: "km", factor: 0.001 },
    "meter": { canonical: "km", factor: 0.001 },
    "meters": { canonical: "km", factor: 0.001 },
    "km": { canonical: "km", factor: 1 },
    "kilometre": { canonical: "km", factor: 1 },
    "kilometres": { canonical: "km", factor: 1 },
    "mile": { canonical: "km", factor: 1.60934 },
    "miles": { canonical: "km", factor: 1.60934 },
};

/**
 * Converts activity.quantity into the canonical unit for its unit family.
 * Leaves the activity untouched (but still returns a new object) if the
 * unit is already canonical or isn't recognized (unrecognized units are
 * left as-is; validateActivity.js's required-fields check will catch a
 * genuinely missing/garbage unit).
 *
 * @param {{type: string, quantity: number, unit: string, date?: string}} activity
 * @returns {{type: string, quantity: number, unit: string, date?: string}}
 */
function normalizeUnits(activity) {
    if (!activity || typeof activity.unit !== "string") {
        return { ...activity };
    }

    const conversion = UNIT_CONVERSIONS[activity.unit.toLowerCase()];
    if (!conversion) {
        // Unknown unit string — leave quantity/unit unchanged.
        return { ...activity };
    }

    return {
        ...activity,
        quantity: activity.quantity * conversion.factor,
        unit: conversion.canonical,
    };
}

module.exports = { normalizeUnits, UNIT_CONVERSIONS };
