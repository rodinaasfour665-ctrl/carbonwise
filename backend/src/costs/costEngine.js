// backend/src/costs/costEngine.js
// Cost Engine — Feature 1
//
// Pure functions only (no DB access here — routes/costs.js does the
// reading/writing). Reuses the company's already-normalized activity
// records (same rows normalizeUnits.js/calculateEmissions.js work with)
// so a cost category's price is always multiplied by the SAME quantity
// (in the SAME unit) the emissions engine used — no separate/duplicated
// normalization logic.
//
// Nothing here is a hardcoded final result: every number is derived from
// the company's actual stored activities plus its (default or
// company-specific) per-unit prices.

const { costCategoryForType, COST_CATEGORIES, DEFAULT_PRICING_EGP } = require("./pricingDefaults");

/**
 * Resolves the effective EGP pricing for a company: defaults, with any
 * company-specific overrides (from the cost_pricing table) applied on top.
 * @param {Array<{category: string, price_egp: number}>} overrides
 * @returns {{electricity: number, diesel: number, petrol: number, waste: number}}
 */
function resolvePricing(overrides = []) {
    const pricing = { ...DEFAULT_PRICING_EGP };
    for (const row of overrides) {
        if (COST_CATEGORIES.includes(row.category) && typeof row.price_egp === "number") {
            pricing[row.category] = row.price_egp;
        }
    }
    return pricing;
}

/**
 * The actual span of the company's activity data, in days (inclusive),
 * used to annualize the observed cost onto a full 365.25-day year. This is
 * "annualize correctly based on the actual data period" — a company with
 * 3 months of data gets its observed cost scaled up ~4x; a company with 15
 * months of data gets it scaled back down toward a single year, rather
 * than every company being naively multiplied/divided by a fixed 12.
 * @param {Array<{date: string}>} activities
 * @returns {{periodDays: number, annualizationFactor: number, startDate: string|null, endDate: string|null}}
 */
function computeAnnualizationFactor(activities) {
    const dates = activities.map((a) => a.date).filter(Boolean).sort();
    if (dates.length === 0) {
        return { periodDays: 0, annualizationFactor: 1, startDate: null, endDate: null };
    }
    const start = dates[0];
    const end = dates[dates.length - 1];
    const msPerDay = 24 * 60 * 60 * 1000;
    const spanDays = Math.round((new Date(end) - new Date(start)) / msPerDay) + 1; // inclusive
    const periodDays = Math.max(1, spanDays);
    const annualizationFactor = 365.25 / periodDays;
    return { periodDays, annualizationFactor, startDate: start, endDate: end };
}

/**
 * Computes the full Cost Engine output for one company.
 * @param {object} params
 * @param {Array<{id:number, date:string, type:string, quantity:number, unit:string}>} params.activities - raw (normalized-unit) activities for the company
 * @param {Array<{category:string, price_egp:number}>} params.pricingOverrides - rows from cost_pricing for this company
 * @param {{employees?: number}} params.company
 * @returns {object} cost breakdown
 */
function computeCosts({ activities, pricingOverrides, company }) {
    const pricing = resolvePricing(pricingOverrides);
    const { periodDays, annualizationFactor, startDate, endDate } = computeAnnualizationFactor(activities);

    const costByCategory = { electricity: 0, diesel: 0, petrol: 0, waste: 0 };
    const costByActivityType = {};
    const costByMonth = {};
    let observedCostEGP = 0;
    let pricedActivityCount = 0;
    let unpricedActivityCount = 0;

    for (const a of activities) {
        const category = costCategoryForType(a.type);
        if (!category || typeof a.quantity !== "number" || !Number.isFinite(a.quantity)) {
            if (!category) unpricedActivityCount += 1;
            continue;
        }
        pricedActivityCount += 1;
        const price = pricing[category];
        const cost = a.quantity * price;

        observedCostEGP += cost;
        costByCategory[category] += cost;
        costByActivityType[a.type] = (costByActivityType[a.type] || 0) + cost;

        if (a.date) {
            const month = a.date.slice(0, 7);
            costByMonth[month] = (costByMonth[month] || 0) + cost;
        }
    }

    const annualizedCostEGP = observedCostEGP * annualizationFactor;
    const annualizedCostByCategory = {};
    const annualizedCostByActivityType = {};
    for (const [cat, val] of Object.entries(costByCategory)) {
        annualizedCostByCategory[cat] = val * annualizationFactor;
    }
    for (const [type, val] of Object.entries(costByActivityType)) {
        annualizedCostByActivityType[type] = val * annualizationFactor;
    }

    const employees = company && typeof company.employees === "number" && company.employees > 0
        ? company.employees
        : null;
    const costPerEmployeeEGP = employees ? annualizedCostEGP / employees : null;

    return {
        currency: "EGP",
        pricing,
        period: { startDate, endDate, periodDays, annualizationFactor },
        observedCostEGP,
        annualizedCostEGP,
        costByCategory,
        annualizedCostByCategory,
        costByActivityType,
        annualizedCostByActivityType,
        costByMonth,
        costPerEmployeeEGP,
        pricedActivityCount,
        unpricedActivityCount,
    };
}

module.exports = { computeCosts, computeAnnualizationFactor, resolvePricing };
