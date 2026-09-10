// backend/src/routes/results.js
// Task R4 (Rodina) — GET /api/results?companyId= -> footprint JSON (calls T5)
// Task R5 (Rodina) — same file: flags[] included in the response
//
// Reads cached per-activity calculations (calculation_results, joined with
// activities) for a company, feeds them into calculateCompanyFootprint()
// (T5) for the aggregate totals, and separately surfaces every activity's
// data-quality flags (from validateActivity, T6) so the frontend's
// FlagsPanel can show which rows need a human look.

const express = require("express");
const router = express.Router();

const { getResultsByCompany } = require("../db/db");
const { calculateCompanyFootprint } = require("../engine/calculateEmissions");

router.get("/", (req, res) => {
    const companyId = req.query.companyId;
    if (!companyId) {
        return res.status(400).json({ error: "companyId query parameter is required" });
    }

    const rows = getResultsByCompany(companyId);

    // Only rows with a real calculation (co2e_kg not null) feed the footprint
    // aggregation - an activity with an uncalculable quantity has no
    // calculation_results row (see activities.js) and shouldn't be silently
    // treated as a zero-emission activity in byCategory/byScope totals.
    const calculatedActivities = rows
        .filter((r) => r.co2e_kg !== null && r.co2e_kg !== undefined)
        .map((r) => ({ type: r.type, date: r.date, co2e_kg: r.co2e_kg, scope: r.scope }));

    const footprint = calculateCompanyFootprint(calculatedActivities);

    // R5: flatten every activity's flags into one array, each entry naming
    // which activity/row it came from.
    const flags = [];
    for (const r of rows) {
        let rowFlags = [];
        try {
            rowFlags = JSON.parse(r.flags || "[]");
        } catch {
            rowFlags = [];
        }
        for (const reason of rowFlags) {
            flags.push({
                activity_id: r.activity_id,
                type: r.type,
                date: r.date,
                reason,
            });
        }
    }

    res.json({
        companyId: Number(companyId),
        activityCount: rows.length,
        ...footprint,
        flags,
    });
});

module.exports = router;
