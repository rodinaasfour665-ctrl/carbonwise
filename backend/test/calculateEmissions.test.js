// backend/test/calculateEmissions.test.js
// Task T7 (Tasneem)
// Edge-case regression tests for calculateEmissions.js / calculateCompanyFootprint()
// per CarbonWise Implementation Plan, Section 4: "zero-value, negative,
// missing-field cases".
//
// Run with: node --test backend/test

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const { calculateEmissions, calculateCompanyFootprint } = require("../src/engine/calculateEmissions");

const factors = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "src", "data", "emission_factors.json"), "utf8")
);

test("calculateEmissions: known manual test case (electricity)", () => {
    const activity = { type: "electricity", quantity: 1450, unit: "kWh", date: "2026-01-01" };
    const result = calculateEmissions(activity, factors);
    const expected = 1450 * 0.13096;
    assert.ok(Math.abs(result.co2e_kg - expected) < 1e-9, `expected ~${expected}, got ${result.co2e_kg}`);
    assert.equal(result.scope, "Scope 2");
    assert.equal(result.factor_used_id, "elec_uk_grid");
});

test("calculateEmissions: known manual test case (diesel fuel, Scope 1)", () => {
    const activity = { type: "fuel_diesel", quantity: 210, unit: "litre", date: "2026-01-01" };
    const result = calculateEmissions(activity, factors);
    const expected = 210 * 2.58354;
    assert.ok(Math.abs(result.co2e_kg - expected) < 1e-9);
    assert.equal(result.scope, "Scope 1");
});

test("calculateEmissions: zero-value quantity produces zero emissions, no throw", () => {
    const activity = { type: "electricity", quantity: 0, unit: "kWh", date: "2026-02-01" };
    const result = calculateEmissions(activity, factors);
    assert.equal(result.co2e_kg, 0);
});

test("calculateEmissions: negative quantity is not rejected here (validateActivity's job), but the formula still computes correctly", () => {
    // calculateEmissions trusts its input; rejecting negative quantities is
    // validateActivity.checkNumericPositive()'s responsibility (tested separately
    // in validateActivity.test.js). What THIS test guards is that a negative
    // quantity still runs through the exact same formula correctly (no special-
    // cased branch that could silently clamp it to 0 or flip its sign).
    const activity = { type: "fuel_diesel", quantity: -50, unit: "litre", date: "2026-01-01" };
    const result = calculateEmissions(activity, factors);
    const expected = -50 * 2.58354;
    assert.ok(Math.abs(result.co2e_kg - expected) < 1e-9, `expected exactly ${expected}, got ${result.co2e_kg}`);
});

test("calculateEmissions: missing quantity field throws", () => {
    const activity = { type: "electricity", unit: "kWh", date: "2026-01-01" };
    assert.throws(() => calculateEmissions(activity, factors), /Invalid quantity/);
});

test("calculateEmissions: missing/garbage type throws 'no emission factor found'", () => {
    const activity = { type: "not_a_real_type", quantity: 10, date: "2026-01-01" };
    assert.throws(() => calculateEmissions(activity, factors), /No emission factor found/);
});

test("calculateEmissions: activity aliases resolve to the correct canonical factor", () => {
    const carResult = calculateEmissions(
        { type: "business_travel_car", quantity: 480, date: "2026-01-01" },
        factors
    );
    assert.equal(carResult.factor_used_id, "transport_car_petrol_avg");
    assert.equal(carResult.scope, "Scope 3");
});

test("calculateCompanyFootprint: totals match a hand-calculated sum for a small sample set", () => {
    const activities = [
        { type: "electricity", quantity: 1450, unit: "kWh", date: "2026-01-01" },
        { type: "fuel_diesel", quantity: 210, unit: "litre", date: "2026-01-01" },
        { type: "business_travel_car", quantity: 480, unit: "km", date: "2026-01-01" },
        { type: "waste_landfill", quantity: 140, unit: "kg", date: "2026-01-01" },
    ];
    const calculated = activities.map((a) => calculateEmissions(a, factors));
    const footprint = calculateCompanyFootprint(calculated);

    const handSum = calculated.reduce((sum, c) => sum + c.co2e_kg, 0);
    assert.ok(Math.abs(footprint.totalCo2eKg - handSum) < 1e-9);

    // Scope 1 should be exactly the diesel emissions (only Scope 1 activity in this set)
    assert.ok(Math.abs(footprint.byScope["Scope 1"] - calculated[1].co2e_kg) < 1e-9);
    // Scope 2 should be exactly the electricity emissions
    assert.ok(Math.abs(footprint.byScope["Scope 2"] - calculated[0].co2e_kg) < 1e-9);
    // byMonth should have a single "2026-01" bucket with the full total
    assert.ok(Math.abs(footprint.byMonth["2026-01"] - footprint.totalCo2eKg) < 1e-9);
});

test("calculateCompanyFootprint: empty activity list returns all-zero footprint, no throw", () => {
    const footprint = calculateCompanyFootprint([]);
    assert.equal(footprint.totalCo2eKg, 0);
    assert.deepEqual(footprint.byScope, { "Scope 1": 0, "Scope 2": 0, "Scope 3": 0 });
    assert.deepEqual(footprint.byCategory, {});
    assert.deepEqual(footprint.byMonth, {});
});
