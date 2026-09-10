// backend/src/server.js
// Task R1 (Rodina) — Express app skeleton exposing REST endpoints under /api/*
//
// Also does one-time startup seeding:
//  - a default company row ("Nile Print & Pack", per the plan's Section 1.3
//    persona) so activities have a company_id to attach to
//  - the 10 emission factors from Tasneem's emission_factors.json into the
//    `emission_factors` table, because calculation_results.factor_used_id
//    is a foreign key into that table (schema.sql, T1) and nothing else
//    populates it.
// Seeding is idempotent: upsertEmissionFactor is an upsert, and the company
// is only inserted if none exists yet.

const fs = require("fs");
const path = require("path");
const express = require("express");

const {
    getCompanies,
    insertCompany,
    upsertEmissionFactor,
} = require("./db/db");

const activitiesRouter = require("./routes/activities");
const resultsRouter = require("./routes/results");
const recommendationsRouter = require("./routes/recommendations");
const whatifRouter = require("./routes/whatif");
const exportRouter = require("./routes/export");
const costsRouter = require("./routes/costs");
const uploadRouter = require("./routes/upload");
const actionPlanRouter = require("./routes/actionPlan"); // Feature: Dynamic Action Plan + Personalization
const dashboardRouter = require("./routes/dashboard"); // Feature: Executive Dashboard
const chatRouter = require("./routes/chat"); // Feature: Grounded Sustainability Chatbot
const PORT = process.env.PORT || 4000;

function seed() {
    if (getCompanies().length === 0) {
        insertCompany({
            name: "Nile Print & Pack",
            sector: "Printing & Packaging (SME)",
            employees: 18,
            location: "Cairo, Egypt",
        });
        console.log("[seed] inserted default company: Nile Print & Pack");
    }

    const factorsPath = path.join(__dirname, "data", "emission_factors.json");
    const factors = JSON.parse(fs.readFileSync(factorsPath, "utf8"));
    for (const f of factors) {
        upsertEmissionFactor(f);
    }
    console.log(`[seed] upserted ${factors.length} emission factors`);
}

const app = express();
app.use(express.json());

// Minimal permissive CORS so Nouran's/Nourhan's frontend (a different dev
// origin, e.g. Vite on :5173) can call this API without extra setup.
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
});


app.get("/", (req, res) => {
  res.json({
    message: "CarbonWise Backend API is running",
    status: "ok",
    endpoints: {
      health: "/api/health",
      activities: "POST /api/activities",
      results: "GET /api/results?companyId=1",
      costs: "GET /api/costs?companyId=1",
      pricing: "POST /api/costs/pricing",
      recommendations: "GET /api/recommendations?companyId=1",
      actionPlan: "GET /api/action-plan?companyId=1",
      dashboard: "GET /api/dashboard?companyId=1",
      upload: "POST /api/upload (multipart, field name 'file')",
      uploadCommit: "POST /api/upload/:id/commit",
      chat: "POST /api/chat { companyId, message } — Grounded Sustainability Chatbot"
    }
  });
});


app.get("/api/health", (req, res) => {
    res.status(200).json({ status: "ok" });
});

app.use("/api/activities", activitiesRouter);
app.use("/api/results", resultsRouter);
app.use("/api/recommendations", recommendationsRouter);
app.use("/api/whatif", whatifRouter);
app.use("/api/export", exportRouter);
app.use("/api/costs", costsRouter);
app.use("/api/upload", uploadRouter);
app.use("/api/action-plan", actionPlanRouter); // Feature: Dynamic Action Plan + Personalization
app.use("/api/dashboard", dashboardRouter); // Feature: Executive Dashboard
app.use("/api/chat", chatRouter); // Feature: Grounded Sustainability Chatbot
// Fallback error handler so a thrown error in a route becomes a clean
// JSON 400/500 instead of an Express HTML stack trace.
app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || "internal error" });
});

if (require.main === module) {
    seed();
    app.listen(PORT, () => {
        console.log(`[server] CarbonWise backend listening on http://localhost:${PORT}`);
    });
}

module.exports = { app, seed };
