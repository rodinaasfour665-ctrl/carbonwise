// backend/test/recommendationEngine.test.js
// Feature 2 — Dynamic Recommendations unit tests
// Run with: node --test backend/test

const test = require("node:test");
const assert = require("node:assert/strict");

const { generateRecommendations } = require("../src/recommendations/recommendationEngine");
const { computeCosts } = require("../src/costs/costEngine");
const { calculateEmissions, calculateCompanyFootprint } = require("../src/engine/calculateEmissions");
const fs = require("fs");
const path = require("path");

const factors = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "src", "data", "emission_factors.json"), "utf8")
);

function buildFootprintAndCosts(rawActivities, company) {
    const calculated = rawActivities.map((a) => calculateEmissions(a, factors));
    const footprint = calculateCompanyFootprint(calculated);
    const costs = computeCosts({ activities: rawActivities, pricingOverrides: [], company });
    return { footprint, costs };
}

test("generateRecommendations: only generates recommendations for categories the company actually has", () => {
    const activities = [{ date: "2026-01-01", type: "electricity", quantity: 1000, unit: "kWh" }];
    const { footprint, costs } = buildFootprintAndCosts(activities, { employees: 10 });
    const recs = generateRecommendations({ footprint, costs, company: { employees: 10 } });

    assert.equal(recs.length, 1);
    assert.equal(recs[0].type, "electricity");
});

test("generateRecommendations: empty footprint produces no recommendations, no throw", () => {
    const recs = generateRecommendations({ footprint: { byCategory: {} }, costs: { annualizedCostByActivityType: {}, period: { annualizationFactor: 1 } }, company: {} });
    assert.deepEqual(recs, []);
});

test("generateRecommendations: co2ReductionKg and annualSavingsEGP are both proportional to reductionPct and current usage", () => {
    const activities = [{ date: "2026-01-01", type: "electricity", quantity: 1000, unit: "kWh" }];
    const { footprint, costs } = buildFootprintAndCosts(activities, { employees: 10 });
    const recs = generateRecommendations({ footprint, costs, company: { employees: 10 } });
    const elec = recs.find((r) => r.type === "electricity");

    assert.ok(Math.abs(elec.co2ReductionKg - elec.currentAnnualCo2eKg * elec.reductionPct) < 1e-6);
    assert.ok(Math.abs(elec.annualSavingsEGP - elec.currentAnnualCostEGP * elec.reductionPct) < 1e-6);
});

test("generateRecommendations: doubling the activity quantity roughly doubles CO2 reduction and savings", () => {
    const small = [{ date: "2026-01-01", type: "electricity", quantity: 1000, unit: "kWh" }];
    const big = [{ date: "2026-01-01", type: "electricity", quantity: 2000, unit: "kWh" }];

    const smallResult = buildFootprintAndCosts(small, { employees: 10 });
    const bigResult = buildFootprintAndCosts(big, { employees: 10 });

    const smallRec = generateRecommendations({ ...smallResult, company: { employees: 10 } })[0];
    const bigRec = generateRecommendations({ ...bigResult, company: { employees: 10 } })[0];

    const co2Ratio = bigRec.co2ReductionKg / smallRec.co2ReductionKg;
    const savingsRatio = bigRec.annualSavingsEGP / smallRec.annualSavingsEGP;
    assert.ok(Math.abs(co2Ratio - 2) < 1e-6, `expected ~2x CO2 reduction, got ${co2Ratio}x`);
    assert.ok(Math.abs(savingsRatio - 2) < 1e-6, `expected ~2x savings, got ${savingsRatio}x`);
});

test("generateRecommendations: payback is null whenever annual savings are <= 0 (e.g. an unpriced category)", () => {
    const activities = [{ date: "2026-01-01", type: "business_travel_car", quantity: 500, unit: "km" }];
    const { footprint, costs } = buildFootprintAndCosts(activities, { employees: 10 });
    const recs = generateRecommendations({ footprint, costs, company: { employees: 10 } });
    const carRec = recs.find((r) => r.type === "business_travel_car");

    assert.equal(carRec.annualSavingsEGP, 0);
    assert.equal(carRec.paybackYears, null);
});

test("generateRecommendations: payback is implementationCost / annualSavings when savings are positive", () => {
    const activities = [{ date: "2026-01-01", type: "electricity", quantity: 1000, unit: "kWh" }];
    const { footprint, costs } = buildFootprintAndCosts(activities, { employees: 10 });
    const recs = generateRecommendations({ footprint, costs, company: { employees: 10 } });
    const elec = recs[0];

    assert.ok(elec.annualSavingsEGP > 0);
    assert.ok(Math.abs(elec.paybackYears - elec.implementationCostEGP / elec.annualSavingsEGP) < 1e-9);
});

test("generateRecommendations: results are sorted by priorityScore descending", () => {
    const activities = [
        { date: "2026-01-01", type: "electricity", quantity: 5000, unit: "kWh" },
        { date: "2026-01-01", type: "fuel_diesel", quantity: 500, unit: "litre" },
        { date: "2026-01-01", type: "business_travel_car", quantity: 50, unit: "km" },
        { date: "2026-01-01", type: "natural_gas", quantity: 1000, unit: "kWh" },
    ];
    const { footprint, costs } = buildFootprintAndCosts(activities, { employees: 18 });
    const recs = generateRecommendations({ footprint, costs, company: { employees: 18 } });

    for (let i = 1; i < recs.length; i++) {
        assert.ok(recs[i - 1].priorityScore >= recs[i].priorityScore);
    }
});

test("generateRecommendations: changing activity quantities changes priority ranking, not just magnitudes", () => {
    // A tiny amount of diesel vs. a huge amount of electricity: electricity should outrank diesel.
    const activities1 = [
        { date: "2026-01-01", type: "electricity", quantity: 10000, unit: "kWh" },
        { date: "2026-01-01", type: "fuel_diesel", quantity: 1, unit: "litre" },
    ];
    const r1 = buildFootprintAndCosts(activities1, { employees: 18 });
    const recs1 = generateRecommendations({ ...r1, company: { employees: 18 } });
    assert.equal(recs1[0].type, "electricity");

    // Flip it: now diesel dominates.
    const activities2 = [
        { date: "2026-01-01", type: "electricity", quantity: 1, unit: "kWh" },
        { date: "2026-01-01", type: "fuel_diesel", quantity: 10000, unit: "litre" },
    ];
    const r2 = buildFootprintAndCosts(activities2, { employees: 18 });
    const recs2 = generateRecommendations({ ...r2, company: { employees: 18 } });
    assert.equal(recs2[0].type, "fuel_diesel");
});
