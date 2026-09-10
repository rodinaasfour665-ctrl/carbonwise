// backend/src/routes/whatif.js
// Task R7 (Rodina) — POST /api/whatif -> recalculated footprint (reuses T4/T5)
//
// Body shape:
//   {
//     "companyId": 1,
//     "modifications": [
//       { "type": "fuel_diesel", "reductionPct": 20 }
//     ]
//   }
// reductionPct is a percentage (0-100), e.g. 20 = "reduce diesel by 20%".
//
// This is a pure simulation: it re-reads the company's ALREADY-STORED raw
// activities, applies the requested reduction(s) to matching activity
// types' quantities in memory, and re-runs calculateEmissions/
// calculateCompanyFootprint (T4/T5) — plus computeCosts (Cost Engine, same
// function routes/costs.js uses) — on the modified set. Nothing is written
// back to the database.
//
// runWhatIf() is the core logic extracted into its own function (added for
// the Grounded Sustainability Chatbot, routes/chat.js) so it can be called
// directly for "what if" questions instead of duplicating this logic or
// making an internal HTTP call to itself. The HTTP handler below is
// unchanged in behavior for existing callers - the response now ALSO
// includes baselineFootprint/costs/baselineCosts alongside the original
// `footprint` field, so nothing that reads the old shape breaks.

const express = require("express");
const router = express.Router();

const { getActivitiesByCompany, getEmissionFactors, getCostPricingByCompany, getCompanyById } = require("../db/db");
const { calculateEmissions, calculateCompanyFootprint } = require("../engine/calculateEmissions");
const { computeCosts } = require("../costs/costEngine");

class WhatIfError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.status = status;
    }
}

function calculateForActivities(activities, factors) {
    return activities
        .filter((a) => Number.isFinite(a.quantity))
        .map((a) => {
            try {
                return calculateEmissions({ type: a.type, quantity: a.quantity, unit: a.unit, date: a.date }, factors);
            } catch {
                return null; // unknown type / no factor - skip, same as activities.js does
            }
        })
        .filter(Boolean);
}

/**
 * Core What-if simulation, reusable outside of the HTTP layer (e.g. by the
 * chatbot's chatEngine.js). No new calculation logic - reuses
 * calculateEmissions/calculateCompanyFootprint (T4/T5) and computeCosts
 * (Cost Engine) exactly as the rest of the app does.
 *
 * @param {{companyId: number|string, modifications: Array<{type:string, reductionPct:number}>}} params
 * @returns {{companyId:number, modifications:object[], footprint:object, baselineFootprint:object, costs:object, baselineCosts:object}}
 */
function runWhatIf({ companyId, modifications }) {
    if (!companyId) throw new WhatIfError("companyId is required");
    if (!Array.isArray(modifications) || modifications.length === 0) {
        throw new WhatIfError("modifications[] is required, e.g. [{ type, reductionPct }]");
    }
    for (const mod of modifications) {
        if (!mod.type || typeof mod.reductionPct !== "number") {
            throw new WhatIfError("each modification needs a type and a numeric reductionPct");
        }
    }

    const rawActivities = getActivitiesByCompany(companyId);
    if (rawActivities.length === 0) {
        throw new WhatIfError(`no activities found for companyId ${companyId}`, 404);
    }

    const modifiedActivities = rawActivities.map((a) => {
        let quantity = a.quantity;
        const applied = [];
        for (const mod of modifications) {
            if (mod.type === a.type) {
                quantity = quantity * (1 - mod.reductionPct / 100);
                applied.push(mod);
            }
        }
        return { ...a, quantity, appliedModifications: applied };
    });

    const factors = getEmissionFactors();
    const footprint = calculateCompanyFootprint(calculateForActivities(modifiedActivities, factors));
    const baselineFootprint = calculateCompanyFootprint(calculateForActivities(rawActivities, factors));

    // Cost comparison: same computeCosts() the Cost Engine already uses,
    // just fed the modified quantities instead of the stored ones - no new
    // cost-calculation logic. Used by the chatbot to answer "how much
    // could we save?" after a what-if.
    const company = getCompanyById(companyId);
    const pricingOverrides = getCostPricingByCompany(companyId);
    const costs = computeCosts({ activities: modifiedActivities, pricingOverrides, company });
    const baselineCosts = computeCosts({ activities: rawActivities, pricingOverrides, company });

    return { companyId: Number(companyId), modifications, footprint, baselineFootprint, costs, baselineCosts };
}

router.post("/", (req, res) => {
    try {
        const { companyId, modifications } = req.body || {};
        const result = runWhatIf({ companyId, modifications });
        res.json(result);
    } catch (err) {
        res.status(err.status || 400).json({ error: err.message });
    }
});

module.exports = router;
module.exports.runWhatIf = runWhatIf;
module.exports.WhatIfError = WhatIfError;
