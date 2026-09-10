// backend/src/routes/dashboard.js
// Feature: Executive Dashboard
//   GET /api/dashboard?companyId=1
//
// This route computes NOTHING new. It calls the exact same functions the
// rest of the app already calls and reshapes their output into one
// dashboard-friendly payload:
//   - getResultsByCompany + calculateCompanyFootprint (T5)             -> emissions (total / scope / category / month)
//   - getActivitiesByCompany + getCostPricingByCompany + computeCosts  -> costs (observed / annualized / per-employee / by-category / by-month)
//   - generateRecommendations (Feature 2 - Dynamic Recommendations)    -> ranked recommendations
//   - personalizeRecommendations + buildActionPlan (Action Plan)       -> action plan summary
//
// Because it reuses those functions instead of recalculating, the
// dashboard is automatically consistent with /api/results, /api/costs,
// /api/recommendations and /api/action-plan, and automatically updates
// whenever an activity is added/edited/uploaded - no separate refresh
// logic needed.

const express = require("express");
const router = express.Router();

const {
    getResultsByCompany,
    getActivitiesByCompany,
    getCompanyById,
    getCostPricingByCompany,
} = require("../db/db");
const { calculateCompanyFootprint } = require("../engine/calculateEmissions");
const { computeCosts } = require("../costs/costEngine");
const { generateRecommendations } = require("../recommendations/recommendationEngine");
const { personalizeRecommendations } = require("../recommendations/personalization");
const { buildActionPlan } = require("../recommendations/actionPlanBuilder");

// Turns a { key: number } map (byCategory, annualizedCostByActivityType, ...)
// into a sorted top-N array. Zero/undefined values are dropped - a company
// with no waste activities shouldn't show a "0 kg waste" hotspot.
function topEntries(obj = {}, limit = 5) {
    return Object.entries(obj)
        .map(([key, value]) => ({ key, value: Number(value || 0) }))
        .filter((e) => e.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, limit);
}

/**
 * Builds the full Executive Dashboard payload from data that has ALREADY
 * been produced by the existing engines. Exported separately from the
 * Express handler so it can be unit-tested without the HTTP/DB layers.
 *
 * @param {{company: object, rows: object[], activities: object[], pricingOverrides: object[]}} params
 */
function buildDashboard({ company, rows, activities, pricingOverrides }) {
    // --- Emissions: identical pipeline to routes/results.js ---
    const calculatedActivities = rows
        .filter((r) => r.co2e_kg !== null && r.co2e_kg !== undefined)
        .map((r) => ({ type: r.type, date: r.date, co2e_kg: r.co2e_kg, scope: r.scope }));
    const footprint = calculateCompanyFootprint(calculatedActivities);

    // --- Costs: identical pipeline to routes/costs.js ---
    const costs = computeCosts({ activities, pricingOverrides, company });

    // --- Recommendations + Personalization + Action Plan: identical
    //     pipeline to routes/recommendations.js and routes/actionPlan.js ---
    const recommendations = generateRecommendations({ footprint, costs, company });
    const personalized = personalizeRecommendations(recommendations, company);
    const plan = buildActionPlan(personalized);

    const employees =
        company && typeof company.employees === "number" && company.employees > 0
            ? company.employees
            : null;

    const kpis = {
        totalCo2eKg: footprint.totalCo2eKg,
        totalCostEGP: costs.observedCostEGP,
        annualizedCostEGP: costs.annualizedCostEGP,
        co2ePerEmployeeKg: employees ? footprint.totalCo2eKg / employees : null,
        costPerEmployeeEGP: costs.costPerEmployeeEGP,
        scope1Kg: footprint.byScope["Scope 1"] || 0,
        scope2Kg: footprint.byScope["Scope 2"] || 0,
        scope3Kg: footprint.byScope["Scope 3"] || 0,
    };

    return {
        companyId: company.id,
        company: {
            name: company.name,
            sector: company.sector,
            employees: company.employees,
            location: company.location,
        },
        currency: "EGP",
        period: costs.period,
        activityCount: rows.length,
        kpis,
        emissionsByScope: footprint.byScope,
        monthlyCo2eTrend: footprint.byMonth,
        monthlyCostTrend: costs.costByMonth,
        topEmissionSources: topEntries(footprint.byCategory, 5),
        topCostDrivers: topEntries(costs.annualizedCostByActivityType, 5),
        topRecommendations: recommendations.slice(0, 5).map((r) => ({
            type: r.type,
            action: r.action,
            category: r.category,
            priorityScore: r.priorityScore,
            co2ReductionKg: r.co2ReductionKg,
            estimatedReductionKg: r.co2ReductionKg, // kept so the existing RecommendationCard.jsx field name works unmodified
            annualSavingsEGP: r.annualSavingsEGP,
            paybackYears: r.paybackYears,
            difficulty: r.difficulty,
            effort: r.effort,
        })),
        actionPlanSummary: {
            totalActions: personalized.length,
            quickWins: plan.quickWins.length,
            mediumTerm: plan.mediumTerm.length,
            longTerm: plan.longTerm.length,
            topQuickWin: plan.quickWins[0] || null,
        },
    };
}

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
    const activities = getActivitiesByCompany(companyId);
    const pricingOverrides = getCostPricingByCompany(companyId);

    const dashboard = buildDashboard({ company, rows, activities, pricingOverrides });
    res.json(dashboard);
});

module.exports = router;
module.exports.buildDashboard = buildDashboard;
module.exports.topEntries = topEntries;
