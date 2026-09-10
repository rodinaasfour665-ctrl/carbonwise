-- CarbonWise Database Schema
-- SQLite (better-sqlite3)
-- Team EcoVision — Tasneem (Data & Calculation Engine)

PRAGMA foreign_keys = ON;

-- 1. Companies
-- Each SME using the tool. For the hackathon, one row: "Nile Print & Pack".
CREATE TABLE IF NOT EXISTS companies (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    sector      TEXT,
    employees   INTEGER,
    location    TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Emission Factors
-- Loaded from backend/src/data/emission_factors.json at server startup.
-- Kept in the DB too so results/exports can reference exactly which
-- factor (and source/year) was used for traceability.
CREATE TABLE IF NOT EXISTS emission_factors (
    id              TEXT PRIMARY KEY,          -- e.g. "elec_uk_grid"
    category        TEXT NOT NULL,             -- e.g. "electricity"
    subcategory     TEXT,                      -- e.g. "diesel"
    unit            TEXT NOT NULL,             -- e.g. "kWh", "litre", "kg", "km"
    factor_kgco2e   REAL NOT NULL,
    scope           TEXT NOT NULL CHECK (scope IN ('Scope 1', 'Scope 2', 'Scope 3')),
    source          TEXT NOT NULL,             -- exact spreadsheet/table name
    year            INTEGER NOT NULL
);

-- 3. Activities
-- Raw activity records submitted via POST /api/activities.
-- Quantities are stored AFTER unit normalization (normalizeUnits.js).
-- flags is a JSON array (empty "[]" if no issues) from validateActivity.js.
CREATE TABLE IF NOT EXISTS activities (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id      INTEGER NOT NULL,
    date            TEXT NOT NULL,             -- ISO date, e.g. "2026-01-01"
    type            TEXT NOT NULL,             -- e.g. "electricity", "fuel_diesel"
    quantity        REAL NOT NULL,             -- normalized quantity
    unit            TEXT NOT NULL,             -- normalized unit (matches factor's unit)
    flags           TEXT NOT NULL DEFAULT '[]',-- JSON array of flag reasons
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (company_id) REFERENCES companies(id)
);

-- 4. Calculation Results
-- One row per calculated activity (output of calculateEmissions.js).
-- calculateCompanyFootprint() aggregates these at query time in GET /api/results,
-- this table just caches the per-activity calculation so it isn't redone every read.
CREATE TABLE IF NOT EXISTS calculation_results (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    activity_id     INTEGER NOT NULL,
    co2e_kg         REAL NOT NULL,
    scope           TEXT NOT NULL CHECK (scope IN ('Scope 1', 'Scope 2', 'Scope 3')),
    factor_used_id  TEXT NOT NULL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (activity_id) REFERENCES activities(id),
    FOREIGN KEY (factor_used_id) REFERENCES emission_factors(id)
);

-- Helpful indexes for the aggregation queries in results.js
CREATE INDEX IF NOT EXISTS idx_activities_company ON activities(company_id);
CREATE INDEX IF NOT EXISTS idx_activities_date ON activities(date);
CREATE INDEX IF NOT EXISTS idx_calc_results_activity ON calculation_results(activity_id);

-- 5. Cost Pricing (additive — Cost Engine feature)
-- Per-company EGP unit pricing overrides, one row per (company, cost
-- category). category is one of: electricity, diesel, petrol, waste
-- (backend/src/costs/pricingDefaults.js). A company with no row for a
-- given category simply uses that category's DEFAULT_PRICING_EGP value —
-- this table only needs to hold overrides, so it starts out empty for
-- every existing company (Nile Print & Pack included) and nothing about
-- their existing data changes until someone POSTs a price.
CREATE TABLE IF NOT EXISTS cost_pricing (
    company_id      INTEGER NOT NULL,
    category        TEXT NOT NULL CHECK (category IN ('electricity', 'diesel', 'petrol', 'waste')),
    price_egp       REAL NOT NULL,
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (company_id, category),
    FOREIGN KEY (company_id) REFERENCES companies(id)
);
