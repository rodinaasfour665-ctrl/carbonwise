// backend/src/db/db.js
// SQLite connection wrapper (better-sqlite3).
// On first run (no tables yet), it executes schema.sql automatically.
// Exposes a single shared connection + a couple of helper queries
// so route files don't touch raw SQL directly where avoidable.

const path = require("path");
const fs = require("fs");
const { DatabaseSync } = require("node:sqlite");

const DB_PATH = path.join(__dirname, "carbonwise.db");
const SCHEMA_PATH = path.join(__dirname, "schema.sql");

// node:sqlite (built into Node.js 22.5+/24) replaces better-sqlite3 here.
// Same synchronous prepare/get/all/run API, no native build step required.
const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL;");

function tablesExist() {
    const row = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='companies'")
        .get();
    return !!row;
}

function initSchema() {
    if (!tablesExist()) {
        const schema = fs.readFileSync(SCHEMA_PATH, "utf8");
        db.exec(schema);
        console.log("[db] schema initialized:", DB_PATH);
    } else {
        console.log("[db] schema already present, skipping init");
    }
}

// --- Additive migration for the Cost Engine feature ---
// initSchema() above only runs schema.sql on a brand-new database (it
// bails out as soon as the `companies` table exists). Nile Print & Pack's
// existing carbonwise.db already has `companies`, so schema.sql's CREATE
// TABLE for `cost_pricing` would otherwise never run against it. This
// migration is separate, additive, and idempotent (CREATE TABLE IF NOT
// EXISTS): it does not touch companies/activities/calculation_results or
// any existing row in them.
function migrateCostPricingTable() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS cost_pricing (
            company_id      INTEGER NOT NULL,
            category        TEXT NOT NULL CHECK (category IN ('electricity', 'diesel', 'petrol', 'waste')),
            price_egp       REAL NOT NULL,
            updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
            PRIMARY KEY (company_id, category),
            FOREIGN KEY (company_id) REFERENCES companies(id)
        )
    `);
}

// --- Additive migration for the Smart File Upload + Data Ingestion feature ---
// Same pattern as migrateCostPricingTable(): CREATE TABLE IF NOT EXISTS is
// idempotent and does not touch companies/activities/calculation_results or
// any existing row in them. `activities.upload_id` is added as a nullable
// column only if it doesn't already exist, so every pre-existing activity
// (including all of Nile Print & Pack's seed/manual-entry data) is left with
// upload_id = NULL, exactly as before this migration ran.
function migrateUploadsTable() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS uploads (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            company_id          INTEGER NOT NULL,
            original_filename   TEXT NOT NULL,
            file_hash           TEXT,
            status              TEXT NOT NULL DEFAULT 'review', -- review | committed | failed
            mapping_json        TEXT,
            parsed_rows_json    TEXT,
            rows_total          INTEGER,
            rows_valid          INTEGER,
            rows_flagged        INTEGER,
            created_at          TEXT NOT NULL DEFAULT (datetime('now')),
            committed_at        TEXT,
            FOREIGN KEY (company_id) REFERENCES companies(id)
        )
    `);

    const activityColumns = db.prepare("PRAGMA table_info(activities)").all();
    const hasUploadId = activityColumns.some((c) => c.name === "upload_id");
    if (!hasUploadId) {
        db.exec("ALTER TABLE activities ADD COLUMN upload_id INTEGER REFERENCES uploads(id)");
        console.log("[db] migrated: activities.upload_id column added");
    }

    db.exec("CREATE INDEX IF NOT EXISTS idx_uploads_company ON uploads(company_id)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_activities_upload ON activities(upload_id)");
}

initSchema();
migrateCostPricingTable();
migrateUploadsTable();

// --- Helper queries used across route files ---

function getCompanies() {
    return db.prepare("SELECT * FROM companies").all();
}

function getCompanyById(id) {
    return db.prepare("SELECT * FROM companies WHERE id = ?").get(id);
}

function insertCompany({ name, sector, employees, location }) {
    const stmt = db.prepare(
        "INSERT INTO companies (name, sector, employees, location) VALUES (?, ?, ?, ?)"
    );
    const info = stmt.run(name, sector, employees, location);
    return getCompanyById(info.lastInsertRowid);
}

function getEmissionFactors() {
    return db.prepare("SELECT * FROM emission_factors").all();
}

function upsertEmissionFactor(factor) {
    const stmt = db.prepare(`
        INSERT INTO emission_factors (id, category, subcategory, unit, factor_kgco2e, scope, source, year)
        VALUES (@id, @category, @subcategory, @unit, @factor_kgco2e, @scope, @source, @year)
        ON CONFLICT(id) DO UPDATE SET
            category = excluded.category,
            subcategory = excluded.subcategory,
            unit = excluded.unit,
            factor_kgco2e = excluded.factor_kgco2e,
            scope = excluded.scope,
            source = excluded.source,
            year = excluded.year
    `);
    stmt.run({ subcategory: null, ...factor });
}

// --- Added for R2/R3/R4/R5/R6/R7 (Rodina) ---
// These extend the original T1-schema-testing helpers above with what the
// route files (activities.js, results.js, recommendations.js, whatif.js)
// need. Nothing above this line was changed.

function insertActivity({ company_id, date, type, quantity, unit, flags, upload_id = null }) {
    // upload_id defaults to null so every existing caller (activities.js's
    // manual-entry POST /api/activities, and any prior insertActivity(...)
    // call site) behaves exactly as before this feature was added.
    const stmt = db.prepare(
        `INSERT INTO activities (company_id, date, type, quantity, unit, flags, upload_id)
         VALUES (@company_id, @date, @type, @quantity, @unit, @flags, @upload_id)`
    );
    const info = stmt.run({ company_id, date, type, quantity, unit, flags, upload_id });
    return getActivityById(info.lastInsertRowid);
}

function getActivityById(id) {
    return db.prepare("SELECT * FROM activities WHERE id = ?").get(id);
}

// Raw activities for a company (used by whatif.js to re-run T4/T5 with
// modified quantities without touching what's already stored).
function getActivitiesByCompany(companyId) {
    return db
        .prepare("SELECT id, date, type, quantity, unit, flags FROM activities WHERE company_id = ?")
        .all(companyId);
}

function insertCalculationResult({ activity_id, co2e_kg, scope, factor_used_id }) {
    const stmt = db.prepare(
        `INSERT INTO calculation_results (activity_id, co2e_kg, scope, factor_used_id)
         VALUES (@activity_id, @co2e_kg, @scope, @factor_used_id)`
    );
    const info = stmt.run({ activity_id, co2e_kg, scope, factor_used_id });
    return db.prepare("SELECT * FROM calculation_results WHERE id = ?").get(info.lastInsertRowid);
}

// Joined view used by GET /api/results (R4/R5): every activity for a company
// plus its cached calculation (if one exists - an activity with an invalid
// quantity is stored with flags but has no calculation_results row).
function getResultsByCompany(companyId) {
    return db
        .prepare(
            `SELECT a.id AS activity_id, a.date, a.type, a.quantity, a.unit, a.flags,
                    c.co2e_kg, c.scope, c.factor_used_id
             FROM activities a
             LEFT JOIN calculation_results c ON c.activity_id = a.id
             WHERE a.company_id = ?
             ORDER BY a.date ASC`
        )
        .all(companyId);
}

// --- Added for the Cost Engine feature ---
// Same additive pattern as the R2-R7 helpers above: route files
// (routes/costs.js) don't touch raw SQL directly.

function getCostPricingByCompany(companyId) {
    return db
        .prepare("SELECT category, price_egp, updated_at FROM cost_pricing WHERE company_id = ?")
        .all(companyId);
}

function upsertCostPricing(companyId, category, priceEgp) {
    const stmt = db.prepare(`
        INSERT INTO cost_pricing (company_id, category, price_egp, updated_at)
        VALUES (@company_id, @category, @price_egp, datetime('now'))
        ON CONFLICT(company_id, category) DO UPDATE SET
            price_egp = excluded.price_egp,
            updated_at = excluded.updated_at
    `);
    stmt.run({ company_id: companyId, category, price_egp: priceEgp });
}

// --- Added for the Smart File Upload + Data Ingestion feature ---
// Same additive pattern as the R2-R7 / Cost Engine helpers above: route
// files (routes/upload.js) and backend/src/ingestion/*.js don't touch raw
// SQL directly.

function insertUpload({ company_id, original_filename, file_hash, status, mapping_json, parsed_rows_json, rows_total, rows_valid, rows_flagged }) {
    const stmt = db.prepare(`
        INSERT INTO uploads (company_id, original_filename, file_hash, status, mapping_json, parsed_rows_json, rows_total, rows_valid, rows_flagged)
        VALUES (@company_id, @original_filename, @file_hash, @status, @mapping_json, @parsed_rows_json, @rows_total, @rows_valid, @rows_flagged)
    `);
    const info = stmt.run({ company_id, original_filename, file_hash, status, mapping_json, parsed_rows_json, rows_total, rows_valid, rows_flagged });
    return getUploadById(info.lastInsertRowid);
}

function getUploadById(id) {
    return db.prepare("SELECT * FROM uploads WHERE id = ?").get(id);
}

function markUploadCommitted(id, { rows_valid, rows_flagged }) {
    db.prepare(
        `UPDATE uploads
         SET status = 'committed', rows_valid = @rows_valid, rows_flagged = @rows_flagged, committed_at = datetime('now')
         WHERE id = @id`
    ).run({ id, rows_valid, rows_flagged });
    return getUploadById(id);
}

function markUploadFailed(id, reason) {
    db.prepare("UPDATE uploads SET status = 'failed', mapping_json = @reason WHERE id = @id").run({
        id,
        reason: JSON.stringify({ error: reason }),
    });
    return getUploadById(id);
}

// Used for lightweight duplicate-upload detection (Section 18 of the spec):
// has this exact file already been successfully committed for this company?
function findCommittedUploadByHash(companyId, fileHash) {
    if (!fileHash) return null;
    return db
        .prepare("SELECT * FROM uploads WHERE company_id = ? AND file_hash = ? AND status = 'committed' ORDER BY committed_at DESC LIMIT 1")
        .get(companyId, fileHash);
}

module.exports = {
    db,
    getCompanies,
    getCompanyById,
    insertCompany,
    getEmissionFactors,
    upsertEmissionFactor,
    insertActivity,
    getActivityById,
    getActivitiesByCompany,
    insertCalculationResult,
    getResultsByCompany,
    getCostPricingByCompany,
    upsertCostPricing,
    insertUpload,
    getUploadById,
    markUploadCommitted,
    markUploadFailed,
    findCommittedUploadByHash,
};