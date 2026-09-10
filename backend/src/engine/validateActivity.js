// backend/src/engine/validateActivity.js
// Task T6 (Tasneem) — Operations 2, 3, 4
// See CarbonWise Implementation Plan, Section 1.5

const fs = require("fs");
const path = require("path");

const PLAUSIBLE_RANGES_PATH = path.join(__dirname, "..", "data", "plausible_ranges.json");
const REQUIRED_FIELDS = ["date", "type", "quantity", "unit"];

function loadPlausibleRanges() {
    const raw = fs.readFileSync(PLAUSIBLE_RANGES_PATH, "utf8");
    return JSON.parse(raw);
}

/**
 * Operation 2 — Required-field validation.
 * Confirms date, type, quantity, and unit are all present and non-null.
 * @param {object} activity
 * @returns {{valid: boolean, missing?: string[]}}
 */
function checkRequiredFields(activity) {
    const missing = REQUIRED_FIELDS.filter(
        (field) => activity[field] === undefined || activity[field] === null || activity[field] === ""
    );
    if (missing.length > 0) {
        return { valid: false, missing };
    }
    return { valid: true };
}

/**
 * Operation 3 — Range/outlier check.
 * Compares quantity against a hardcoded plausible range per activity type
 * (backend/src/data/plausible_ranges.json). Out-of-range values are FLAGGED,
 * not rejected — the record is still stored/calculated, the UI just marks
 * it for user confirmation.
 * @param {object} activity
 * @returns {{flagged: boolean, reason?: string}}
 */
function checkRangeOutlier(activity) {
    const ranges = loadPlausibleRanges();
    const range = ranges[activity.type];

    // No known range for this activity type -> nothing to flag against.
    if (!range) {
        return { flagged: false };
    }

    if (typeof activity.quantity !== "number" || Number.isNaN(activity.quantity)) {
        // Not this function's job (see checkNumericPositive) — don't double-flag.
        return { flagged: false };
    }

    if (activity.quantity < range.min || activity.quantity > range.max) {
        return {
            flagged: true,
            reason: `${activity.type} ${activity.quantity}${activity.unit ? " " + activity.unit : ""} exceeds expected range (${range.min}-${range.max} ${range.unit})`,
        };
    }

    return { flagged: false };
}

/**
 * Operation 4 — Numeric/type validation.
 * Confirms quantity is a number and is not negative.
 * @param {object} activity
 * @returns {{valid: boolean, reason?: string}}
 */
function checkNumericPositive(activity) {
    if (typeof activity.quantity !== "number" || Number.isNaN(activity.quantity)) {
        return { valid: false, reason: `quantity must be a number, got: ${JSON.stringify(activity.quantity)}` };
    }
    if (activity.quantity < 0) {
        return { valid: false, reason: `quantity must not be negative, got: ${activity.quantity}` };
    }
    return { valid: true };
}

/**
 * Convenience wrapper: runs all three checks and returns a combined
 * flags[] array (empty if the activity is clean), matching the "flags"
 * column described for the `activities` table in schema.sql (T1).
 * @param {object} activity
 * @returns {string[]} array of human-readable flag reasons
 */
function validateActivity(activity) {
    const flags = [];

    const requiredCheck = checkRequiredFields(activity);
    if (!requiredCheck.valid) {
        flags.push(`missing required field(s): ${requiredCheck.missing.join(", ")}`);
    }

    const numericCheck = checkNumericPositive(activity);
    if (!numericCheck.valid) {
        flags.push(numericCheck.reason);
    }

    // Only check range if quantity is actually a valid number
    if (numericCheck.valid) {
        const rangeCheck = checkRangeOutlier(activity);
        if (rangeCheck.flagged) {
            flags.push(rangeCheck.reason);
        }
    }

    return flags;
}

module.exports = { checkRequiredFields, checkRangeOutlier, checkNumericPositive, validateActivity };
