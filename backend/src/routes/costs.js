// backend/src/routes/costs.js
// Cost Engine — Feature 1
//   GET  /api/costs?companyId=1          -> full cost breakdown for a company
//   POST /api/costs/pricing              -> set/override a company's EGP unit pricing
//
// Reuses the same raw (normalized-unit) activities getActivitiesByCompany()
// already provides to whatif.js/export.js — no separate normalization path.

const express = require("express");
const router = express.Router();

const { getActivitiesByCompany, getCompanyById, getCostPricingByCompany, upsertCostPricing } = require("../db/db");
const { computeCosts } = require("../costs/costEngine");
const { COST_CATEGORIES } = require("../costs/pricingDefaults");

router.get("/", (req, res) => {
    const companyId = req.query.companyId;
    if (!companyId) {
        return res.status(400).json({ error: "companyId query parameter is required" });
    }

    const company = getCompanyById(companyId);
    if (!company) {
        return res.status(404).json({ error: `no company found for companyId ${companyId}` });
    }

    const activities = getActivitiesByCompany(companyId);
    const pricingOverrides = getCostPricingByCompany(companyId);

    const costs = computeCosts({ activities, pricingOverrides, company });

    res.json({
        companyId: Number(companyId),
        company: { name: company.name, employees: company.employees, sector: company.sector },
        activityCount: activities.length,
        ...costs,
    });
});

router.post("/pricing", (req, res) => {
    try {
        const body = req.body || {};
        const { companyId } = body;

        if (!companyId) {
            return res.status(400).json({ error: "companyId is required" });
        }
        const company = getCompanyById(companyId);
        if (!company) {
            return res.status(404).json({ error: `no company found for companyId ${companyId}` });
        }

        const updates = COST_CATEGORIES.filter((cat) => body[cat] !== undefined);
        if (updates.length === 0) {
            return res.status(400).json({
                error: `at least one of ${COST_CATEGORIES.join(", ")} (EGP per unit) is required`,
            });
        }

        for (const category of updates) {
            const price = Number(body[category]);
            if (!Number.isFinite(price) || price < 0) {
                return res.status(400).json({ error: `${category} must be a non-negative number` });
            }
            upsertCostPricing(companyId, category, price);
        }

        const pricingOverrides = getCostPricingByCompany(companyId);
        res.status(200).json({
            companyId: Number(companyId),
            updatedCategories: updates,
            pricing: pricingOverrides,
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
