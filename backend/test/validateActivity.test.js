// backend/test/validateActivity.test.js
// Task T7 (Tasneem)
// Regression tests for normalizeUnits.js and validateActivity.js
// per CarbonWise Implementation Plan, Section 4.
//
// Run with: node --test backend/test

const test = require("node:test");
const assert = require("node:assert/strict");

const { normalizeUnits } = require("../src/engine/normalizeUnits");
const {
    checkRequiredFields,
    checkRangeOutlier,
    checkNumericPositive,
    validateActivity,
} = require("../src/engine/validateActivity");

// --- normalizeUnits.js ---

test("normalizeUnits: converts tonnes to kg (plan's worked example)", () => {
    const result = normalizeUnits({ type: "waste_landfill", quantity: 2, unit: "tonne" });
    assert.equal(result.quantity, 2000);
    assert.equal(result.unit, "kg");
});

test("normalizeUnits: leaves an already-canonical unit unchanged", () => {
    const result = normalizeUnits({ type: "electricity", quantity: 1450, unit: "kWh" });
    assert.equal(result.quantity, 1450);
    assert.equal(result.unit, "kWh");
});

test("normalizeUnits: unrecognized unit passes through unchanged (doesn't throw)", () => {
    const result = normalizeUnits({ type: "electricity", quantity: 5, unit: "furlongs" });
    assert.equal(result.quantity, 5);
    assert.equal(result.unit, "furlongs");
});

// --- checkRequiredFields ---

test("checkRequiredFields: valid activity passes", () => {
    const result = checkRequiredFields({ date: "2026-01-01", type: "electricity", quantity: 1450, unit: "kWh" });
    assert.equal(result.valid, true);
});

test("checkRequiredFields: missing-field case reports exactly what's missing", () => {
    const result = checkRequiredFields({ date: "2026-01-01", type: "electricity", unit: "kWh" });
    assert.equal(result.valid, false);
    assert.deepEqual(result.missing, ["quantity"]);
});

test("checkRequiredFields: multiple missing fields are all reported", () => {
    const result = checkRequiredFields({ type: "electricity" });
    assert.equal(result.valid, false);
    assert.deepEqual(result.missing, ["date", "quantity", "unit"]);
});

test("checkRequiredFields: quantity of 0 is present, not missing (guards against a falsy-value bug)", () => {
    // A naive implementation checking `!activity.quantity` would wrongly treat
    // 0 as "missing" since 0 is falsy in JS. This must not happen — 0 is a
    // valid, present quantity (e.g. the "0 kWh" bad-data row from Section 1.3).
    const result = checkRequiredFields({ date: "2026-02-01", type: "electricity", quantity: 0, unit: "kWh" });
    assert.equal(result.valid, true);
});

// --- checkNumericPositive ---

test("checkNumericPositive: negative-value case is rejected", () => {
    const result = checkNumericPositive({ quantity: -50 });
    assert.equal(result.valid, false);
});

test("checkNumericPositive: zero is valid (zero is not negative)", () => {
    const result = checkNumericPositive({ quantity: 0 });
    assert.equal(result.valid, true);
});

test("checkNumericPositive: non-numeric quantity is rejected", () => {
    const result = checkNumericPositive({ quantity: "not-a-number" });
    assert.equal(result.valid, false);
});

// --- checkRangeOutlier: the plan's 2 deliberately-bad sample rows ---

test("checkRangeOutlier: zero-value case (0 kWh) is flagged as implausible", () => {
    const result = checkRangeOutlier({ type: "electricity", quantity: 0, unit: "kWh" });
    assert.equal(result.flagged, true);
});

test("checkRangeOutlier: implausibly-high case (40000 kWh) is flagged", () => {
    const result = checkRangeOutlier({ type: "electricity", quantity: 40000, unit: "kWh" });
    assert.equal(result.flagged, true);
});

test("checkRangeOutlier: a normal in-range value is NOT flagged", () => {
    const result = checkRangeOutlier({ type: "electricity", quantity: 1450, unit: "kWh" });
    assert.equal(result.flagged, false);
});

test("checkRangeOutlier: unknown activity type has no range to compare against -> not flagged", () => {
    const result = checkRangeOutlier({ type: "some_future_activity_type", quantity: 999999 });
    assert.equal(result.flagged, false);
});

// --- validateActivity: combined flags[], matching schema.sql's `flags` column ---

test("validateActivity: clean activity produces empty flags[]", () => {
    const flags = validateActivity({ date: "2026-01-01", type: "electricity", quantity: 1450, unit: "kWh" });
    assert.deepEqual(flags, []);
});

test("validateActivity: missing-field case produces a flag", () => {
    const flags = validateActivity({ type: "electricity", quantity: 1450, unit: "kWh" }); // no date
    assert.equal(flags.length, 1);
});

test("validateActivity: negative-value case produces a flag and skips range check", () => {
    const flags = validateActivity({ date: "2026-01-01", type: "fuel_diesel", quantity: -50, unit: "litre" });
    assert.equal(flags.length, 1);
    assert.match(flags[0], /must not be negative/);
});

test("validateActivity: the plan's 2 deliberately-bad sample rows both trigger flags", () => {
    const zeroRow = { date: "2026-02-01", type: "electricity", quantity: 0, unit: "kWh" };
    const highRow = { date: "2026-03-01", type: "electricity", quantity: 40000, unit: "kWh" };
    assert.ok(validateActivity(zeroRow).length > 0, "zero kWh row should be flagged");
    assert.ok(validateActivity(highRow).length > 0, "40000 kWh row should be flagged");
});
