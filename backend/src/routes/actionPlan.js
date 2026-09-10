// backend/src/routes/actionPlan.js
// Feature: Dynamic Action Plan (+ Recommendation Personalization)
//   GET /api/action-plan?companyId=1
//
// Deliberately mirrors routes/recommendations.js's own pipeline
// (getResultsByCompany -> calculateCompanyFootprint -> getActivitiesByCompany
// + getCostPricingByCompany -> computeCosts -> generateRecommendations) so
// this route reuses the exact same Cost Engine and Dynamic Recommendation
// Engine outputs instead of recalculating anything. It only adds two more
// steps on top of what generateRecommendations() already returns:
//   1. personalizeRecommendations() - company-profile relevance scoring
//   2. buildActionPlan() - buckets into Quick Wins / Medium Term / Long Term

const express = require("express");
const router = express.Router();

const { getResultsByCompany, getActivitiesByCompany, getCompanyById, getCostPricingByCompany } = require("../db/db");
const { calculateCompanyFootprint } = require("../engine/calculateEmissions");
const { computeCosts } = require("../costs/costEngine");
const { generateRecommendations } = require("../recommendations/recommendationEngine");
const { personalizeRecommendations } = require("../recommendations/personalization");
const { buildActionPlan } = require("../recommendations/actionPlanBuilder");

router.get("/", (req, res) => {
    const companyId = req.query.companyId;
    if (!companyId) {
        return res.status(400).json({ error: "companyId query parameter is required" });
    }

    const company = getCompanyById(companyId);
    if (!company) {
        return res.status(404).json({ error: `no company found for companyId ${companyId}` });
    }

    // --- identical to routes/recommendations.js from here... ---
    const rows = getResultsByCompany(companyId);
    const calculatedActivities = rows
        .filter((r) => r.co2e_kg !== null && r.co2e_kg !== undefined)
        .map((r) => ({ type: r.type, date: r.date, co2e_kg: r.co2e_kg, scope: r.scope }));

    const footprint = calculateCompanyFootprint(calculatedActivities);

    const activities = getActivitiesByCompany(companyId);
    const pricingOverrides = getCostPricingByCompany(companyId);
    const costs = computeCosts({ activities, pricingOverrides, company });

    const recommendations = generateRecommendations({ footprint, costs, company });
    // --- ...to here: same recommendations GET /api/recommendations returns ---

    const personalized = personalizeRecommendations(recommendations, company);
    const plan = buildActionPlan(personalized);

    res.json({
        companyId: Number(companyId),
        company: { name: company.name, sector: company.sector, employees: company.employees },
        currency: "EGP",
        totalActions: personalized.length,
        timelineDefinitions: plan.timelineDefinitions,
        quickWins: plan.quickWins,
        mediumTerm: plan.mediumTerm,
        longTerm: plan.longTerm,
    });
});

module.exports = router;
