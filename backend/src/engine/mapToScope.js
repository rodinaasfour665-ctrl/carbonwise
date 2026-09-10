// backend/src/engine/mapToScope.js
// Task T3 (Tasneem)
// Fixed lookup table mapping activity type -> "Scope 1" / "Scope 2" / "Scope 3"
// See CarbonWise Implementation Plan, Section 2.2
//
// Rule of thumb:
//   Scope 1 = burning fuel yourselves (company-owned/controlled combustion)
//   Scope 2 = electricity you bought
//   Scope 3 = everything else in the value chain (travel, waste, purchased goods)
//
// Activity type IDs below match the "category"/"subcategory" naming used in
// backend/src/data/emission_factors.json (T2) so the two files stay consistent.

const SCOPE_MAP = {
    // Scope 1 — direct combustion of fuel the company owns/controls
    fuel_diesel: "Scope 1",
    fuel_petrol: "Scope 1",
    fuel_natural_gas: "Scope 1",

    // Scope 2 — purchased electricity
    electricity: "Scope 2",
    elec_uk_grid: "Scope 2", // canonical id from emission_factors.json

    // Scope 3 — everything else (travel, waste)
    transport_car_petrol_avg: "Scope 3",
    transport_car_diesel_avg: "Scope 3",
    transport_rail_national: "Scope 3",
    transport_flight_domestic: "Scope 3",
    waste_landfill_mixed: "Scope 3",
    waste_recycled_mixed: "Scope 3",

    // Aliases: some parts of the plan/sample data refer to activities by a
    // shorter "type" name (e.g. sample_company.json uses "business_travel_car",
    // "waste_landfill") instead of the emission_factors.json id. Both naming
    // styles are mapped here so calculateEmissions.js can call mapToScope()
    // with whichever "type" string the activity record actually has.
    business_travel_car: "Scope 3",
    business_travel_flight: "Scope 3",
    business_travel_rail: "Scope 3",
    waste_landfill: "Scope 3",
    waste_recycled: "Scope 3",
    natural_gas: "Scope 1",
};

/**
 * Returns the scope ("Scope 1" | "Scope 2" | "Scope 3") for a given
 * activity type string.
 * @param {string} activityType
 * @returns {string}
 * @throws {Error} if the activity type is not in the lookup table
 */
function mapToScope(activityType) {
    const scope = SCOPE_MAP[activityType];
    if (!scope) {
        throw new Error(`Unknown activity type: ${activityType}`);
    }
    return scope;
}

module.exports = { mapToScope, SCOPE_MAP };
