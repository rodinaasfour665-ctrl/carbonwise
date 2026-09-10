// backend/src/routes/recommendations.js
// Task R6 (Rodina) — GET /api/recommendations?companyId= -> ranked recommendations
//
// Upgraded (Feature 2 — Dynamic Recommendations) to use the company's
// actual activities, emissions (calculateCompanyFootprint, T5), costs
// (costEngine.computeCosts, Feature 1) and employees, via
// recommendationEngine.generateRecommendations(). See
// recommendations/recommendationLibrary.js for the underlying action
// assumptions and recommendations/recommendationEngine.js for the
// CO2/savings/cost/payback/priority calculations.

const express = require("express");
const router = express.Router();

const { getResultsByCompany, getActivitiesByCompany, getCompanyById, getCostPricingByCompany } = require("../db/db");
const { calculateCompanyFootprint } = require("../engine/calculateEmissions");
const { computeCosts } = require("../costs/costEngine");
const { generateRecommendations } = require("../recommendations/recommendationEngine");

router.get("/", (req, res) => {
    const companyId = req.query.companyId;
    if (!companyId) {
        return res.status(400).json({ error: "companyId query parameter is required" });
    }

    const company = getCompanyById(companyId);
    if (!company) {
        return res.status(404).json({ error: `no company found for companyId ${companyId}` });
    }

    const rows = getResultsByCompany(companyId);
    const calculatedActivities = rows
        .filter((r) => r.co2e_kg !== null && r.co2e_kg !== undefined)
        .map((r) => ({ type: r.type, date: r.date, co2e_kg: r.co2e_kg, scope: r.scope }));

    const footprint = calculateCompanyFootprint(calculatedActivities);

    const activities = getActivitiesByCompany(companyId);
    const pricingOverrides = getCostPricingByCompany(companyId);
    const costs = computeCosts({ activities, pricingOverrides, company });

    const recommendations = generateRecommendations({ footprint, costs, company });

    res.json({
        companyId: Number(companyId),
        company: { name: company.name, sector: company.sector, employees: company.employees },
        currency: "EGP",
        annualizationFactor: costs.period.annualizationFactor,
        priorityFormula: {
            emissionsWeight: 0.4,
            savingsWeight: 0.3,
            implementationCostWeight: 0.15,
            difficultyWeight: 0.1,
            paybackWeight: 0.05,
        },
        recommendations,
    });
});

module.exports = router;
