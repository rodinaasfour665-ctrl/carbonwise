// backend/test/costEngine.test.js
// Feature 1 — Cost Engine unit tests
// Run with: node --test backend/test

const test = require("node:test");
const assert = require("node:assert/strict");

const { computeCosts, computeAnnualizationFactor, resolvePricing } = require("../src/costs/costEngine");
const { DEFAULT_PRICING_EGP } = require("../src/costs/pricingDefaults");

test("resolvePricing: with no overrides, returns the defaults", () => {
    const pricing = resolvePricing([]);
    assert.deepEqual(pricing, DEFAULT_PRICING_EGP);
});

test("resolvePricing: a company override replaces only that category's price", () => {
    const pricing = resolvePricing([{ category: "electricity", price_egp: 3 }]);
    assert.equal(pricing.electricity, 3);
    assert.equal(pricing.diesel, DEFAULT_PRICING_EGP.diesel);
});

test("computeAnnualizationFactor: a full calendar year of data has factor ~1", () => {
    const activities = [{ date: "2026-01-01" }, { date: "2026-12-31" }];
    const { periodDays, annualizationFactor } = computeAnnualizationFactor(activities);
    assert.equal(periodDays, 365);
    assert.ok(Math.abs(annualizationFactor - 365.25 / 365) < 1e-6);
});

test("computeAnnualizationFactor: 3 months of data scales up toward a full year", () => {
    const activities = [{ date: "2026-01-01" }, { date: "2026-03-31" }];
    const { annualizationFactor } = computeAnnualizationFactor(activities);
    assert.ok(annualizationFactor > 3.5 && annualizationFactor < 4.5);
});

test("computeAnnualizationFactor: no activities returns a neutral factor of 1, no throw", () => {
    const { annualizationFactor, periodDays } = computeAnnualizationFactor([]);
    assert.equal(annualizationFactor, 1);
    assert.equal(periodDays, 0);
});

test("computeCosts: observed cost is quantity x price, summed only over priced categories", () => {
    const activities = [
        { date: "2026-01-01", type: "electricity", quantity: 100, unit: "kWh" },
        { date: "2026-01-01", type: "fuel_diesel", quantity: 10, unit: "litre" },
        { date: "2026-01-01", type: "business_travel_car", quantity: 50, unit: "km" }, // no cost category
    ];
    const result = computeCosts({ activities, pricingOverrides: [], company: { employees: 10 } });

    const expectedElec = 100 * DEFAULT_PRICING_EGP.electricity;
    const expectedDiesel = 10 * DEFAULT_PRICING_EGP.diesel;
    assert.ok(Math.abs(result.costByCategory.electricity - expectedElec) < 1e-9);
    assert.ok(Math.abs(result.costByCategory.diesel - expectedDiesel) < 1e-9);
    assert.equal(result.costByCategory.petrol, 0);
    assert.equal(result.costByCategory.waste, 0);
    assert.ok(Math.abs(result.observedCostEGP - (expectedElec + expectedDiesel)) < 1e-9);
    assert.equal(result.pricedActivityCount, 2);
    assert.equal(result.unpricedActivityCount, 1);
});

test("computeCosts: a company-specific price override changes the observed cost", () => {
    const activities = [{ date: "2026-01-01", type: "electricity", quantity: 100, unit: "kWh" }];
    const withDefault = computeCosts({ activities, pricingOverrides: [], company: {} });
    const withOverride = computeCosts({
        activities,
        pricingOverrides: [{ category: "electricity", price_egp: 5 }],
        company: {},
    });
    assert.equal(withDefault.observedCostEGP, 100 * DEFAULT_PRICING_EGP.electricity);
    assert.equal(withOverride.observedCostEGP, 500);
    assert.notEqual(withDefault.observedCostEGP, withOverride.observedCostEGP);
});

test("computeCosts: annualizedCostEGP scales the observed cost by the actual data period, not a fixed 12x", () => {
    // A single month of electricity use should scale to roughly 12x when annualized.
    const activities = [
        { date: "2026-01-01", type: "electricity", quantity: 1000, unit: "kWh" },
        { date: "2026-01-31", type: "electricity", quantity: 1000, unit: "kWh" },
    ];
    const result = computeCosts({ activities, pricingOverrides: [], company: {} });
    const ratio = result.annualizedCostEGP / result.observedCostEGP;
    assert.ok(ratio > 10 && ratio < 13, `expected ~12x annualization for a 1-month span, got ${ratio}x`);
});

test("computeCosts: costPerEmployeeEGP divides the annualized cost by employees; null when employees unknown", () => {
    const activities = [{ date: "2026-01-01", type: "electricity", quantity: 100, unit: "kWh" }];
    const withEmployees = computeCosts({ activities, pricingOverrides: [], company: { employees: 10 } });
    const withoutEmployees = computeCosts({ activities, pricingOverrides: [], company: {} });

    assert.ok(Math.abs(withEmployees.costPerEmployeeEGP - withEmployees.annualizedCostEGP / 10) < 1e-9);
    assert.equal(withoutEmployees.costPerEmployeeEGP, null);
});

test("computeCosts: costByMonth buckets by activity month and sums correctly", () => {
    const activities = [
        { date: "2026-01-05", type: "electricity", quantity: 100, unit: "kWh" },
        { date: "2026-01-20", type: "electricity", quantity: 50, unit: "kWh" },
        { date: "2026-02-01", type: "fuel_diesel", quantity: 10, unit: "litre" },
    ];
    const result = computeCosts({ activities, pricingOverrides: [], company: {} });
    assert.ok(Math.abs(result.costByMonth["2026-01"] - 150 * DEFAULT_PRICING_EGP.electricity) < 1e-9);
    assert.ok(Math.abs(result.costByMonth["2026-02"] - 10 * DEFAULT_PRICING_EGP.diesel) < 1e-9);
});

test("computeCosts: empty activity list returns an all-zero breakdown, no throw", () => {
    const result = computeCosts({ activities: [], pricingOverrides: [], company: { employees: 5 } });
    assert.equal(result.observedCostEGP, 0);
    assert.equal(result.annualizedCostEGP, 0);
    assert.deepEqual(result.costByMonth, {});
});
