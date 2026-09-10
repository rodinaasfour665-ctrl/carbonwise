// backend/src/costs/pricingDefaults.js
// Cost Engine — pricing configuration
//
// Maps each activity "type" (the same strings used throughout
// engine/calculateEmissions.js, mapToScope.js and the `activities` table)
// to one of the 4 cost categories this Cost Engine prices in EGP:
// electricity, diesel, petrol, waste.
//
// Activity types with no entry here (natural_gas, business travel by car/
// rail/flight, etc.) are outside the Cost Engine's scope per the spec
// ("Support electricity, diesel, petrol, and waste pricing") — they still
// have emissions, they just have no EGP cost attached.
//
// DEFAULT_PRICING_EGP are starting per-unit prices (EGP per the activity's
// canonical stored unit — kWh for electricity, litre for diesel/petrol, kg
// for waste). They are assumptions, not verified market data — a company
// overrides them for its own contract/tariff via POST /api/costs/pricing.
// Nothing computed FROM these defaults (observed cost, annualized cost,
// savings, recommendations, ...) is itself hardcoded — those are always
// derived from a company's actual stored activity quantities.

const ACTIVITY_TYPE_TO_COST_CATEGORY = {
    electricity: "electricity",
    elec_uk_grid: "electricity",

    fuel_diesel: "diesel",

    fuel_petrol: "petrol",

    waste_landfill_mixed: "waste",
    waste_landfill: "waste",
    waste_recycled_mixed: "waste",
    waste_recycled: "waste",
};

const COST_CATEGORIES = ["electricity", "diesel", "petrol", "waste"];

// EGP per canonical unit (kWh / litre / litre / kg). Assumption defaults,
// overridable per companyId via POST /api/costs/pricing.
const DEFAULT_PRICING_EGP = {
    electricity: 2.15, // EGP per kWh, commercial/industrial tariff estimate
    diesel: 19.5, // EGP per litre
    petrol: 17.25, // EGP per litre (petrol 92)
    waste: 0.75, // EGP per kg, commercial collection/disposal fee estimate
};

function costCategoryForType(type) {
    return ACTIVITY_TYPE_TO_COST_CATEGORY[type] || null;
}

module.exports = {
    ACTIVITY_TYPE_TO_COST_CATEGORY,
    COST_CATEGORIES,
    DEFAULT_PRICING_EGP,
    costCategoryForType,
};
