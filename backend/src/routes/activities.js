// backend/src/routes/activities.js
// Task R3 (Rodina) — POST /api/activities
//
// Pipeline (per the plan): raw activity JSON
//   -> normalizeUnits()        (T6, Operation 1)
//   -> validateActivity()      (T6, Operations 2-4 -> flags[], flag-not-reject)
//   -> store activity row (with flags)
//   -> calculateEmissions()    (T4) -> store calculation_results row
//
// A flagged activity is still stored and (if its quantity is numeric) still
// calculated - flags mark data for review, they don't block the pipeline.

const express = require("express");
const router = express.Router();

const { getEmissionFactors, insertActivity, insertCalculationResult } = require("../db/db");
const { normalizeUnits } = require("../engine/normalizeUnits");
const { validateActivity } = require("../engine/validateActivity");
const { calculateEmissions } = require("../engine/calculateEmissions");

router.post("/", (req, res) => {
    try {
        const body = req.body || {};
        const { company_id, date, type, unit, factor_id } = body;

        if (!company_id) {
            return res.status(400).json({ error: "company_id is required" });
        }
        if (!type) {
            return res.status(400).json({ error: "type is required" });
        }

        // Coerce quantity to a number for storage; keep the original value
        // around so validateActivity can still report exactly what was wrong
        // with it (e.g. a string, or missing entirely).
        const rawQuantity = body.quantity;
        const numericQuantity =
            typeof rawQuantity === "number" ? rawQuantity : Number(rawQuantity);

        // Operation 1: unit normalization (converts quantity into the
        // canonical unit for its family, e.g. tonne -> kg).
        const normalized = normalizeUnits({
            date,
            type,
            unit,
            quantity: typeof rawQuantity === "number" ? rawQuantity : rawQuantity,
        });

        // Operations 2-4: validate against the ORIGINAL incoming shape so
        // missing/non-numeric fields are reported accurately.
        const flags = validateActivity({ date, type, quantity: rawQuantity, unit });

        const storedQuantity = Number.isFinite(normalized.quantity)
            ? normalized.quantity
            : Number.isFinite(numericQuantity)
            ? numericQuantity
            : 0;

        const activityRow = insertActivity({
            company_id,
            date: date || null,
            type,
            quantity: storedQuantity,
            unit: normalized.unit || unit || null,
            flags: JSON.stringify(flags),
        });

        let calculation = null;
        if (Number.isFinite(storedQuantity)) {
            try {
                const factors = getEmissionFactors();
                const calculated = calculateEmissions(
                    { type, quantity: storedQuantity, unit: normalized.unit, date, factor_id },
                    factors
                );
                calculation = insertCalculationResult({
                    activity_id: activityRow.id,
                    co2e_kg: calculated.co2e_kg,
                    scope: calculated.scope,
                    factor_used_id: calculated.factor_used_id,
                });
            } catch (calcErr) {
                // Unknown activity type / no matching factor: the activity is
                // still stored (with flags), we just can't calculate it yet.
                flags.push(`calculation skipped: ${calcErr.message}`);
            }
        }

        res.status(201).json({
            activity: { ...activityRow, flags },
            calculation,
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
