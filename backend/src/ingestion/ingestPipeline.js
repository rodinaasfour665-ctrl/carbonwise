// backend/src/ingestion/ingestPipeline.js
// Smart File Upload — orchestration layer.
//
// Wires together (in order):
//   parseSpreadsheet.js        (this feature)
//   detectColumns.js           (this feature)
//   ../engine/normalizeUnits.js    (EXISTING — reused as-is)
//   ../engine/validateActivity.js  (EXISTING — reused as-is)
//   ../engine/calculateEmissions.js(EXISTING — reused as-is)
//   ../db/db.js                (EXISTING helpers, extended additively)
//
// Two-step flow:
//   previewUpload()  -> parses + maps + validates WITHOUT writing activities.
//                        Persists a row in `uploads` (status "review") so
//                        the browser doesn't have to re-upload the file for
//                        the commit step.
//   commitUpload()   -> takes the user-confirmed mapping, builds real
//                        activity records the exact same way
//                        POST /api/activities does, and inserts them inside
//                        a transaction.

const crypto = require("crypto");

const { parseSpreadsheet, ParseError } = require("./parseSpreadsheet");
const { detectColumns, DEFAULT_UNIT_BY_TYPE } = require("./detectColumns");

const { normalizeUnits } = require("../engine/normalizeUnits");
const { validateActivity } = require("../engine/validateActivity");
const { calculateEmissions } = require("../engine/calculateEmissions");

const {
    db,
    getEmissionFactors,
    insertActivity,
    insertCalculationResult,
    insertUpload,
    getUploadById,
    markUploadCommitted,
    findCommittedUploadByHash,
} = require("../db/db");

const ACTIVITY_TARGETS = new Set(Object.keys(DEFAULT_UNIT_BY_TYPE));
const PREVIEW_ROW_LIMIT = 25;

class IngestError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.status = status;
    }
}

function hashBuffer(buffer) {
    return crypto.createHash("sha256").update(buffer).digest("hex");
}

/** Normalizes a raw date cell value to "YYYY-MM-DD", or null if it can't be parsed. */
function normalizeDateValue(raw) {
    if (raw === undefined || raw === null || raw === "") return null;

    // xlsx with raw:true can hand back a JS Date for real date-formatted cells.
    if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
        return raw.toISOString().slice(0, 10);
    }

    const str = String(raw).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

    // DD/MM/YYYY or D/M/YYYY (common in non-US spreadsheets)
    const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(str);
    if (dmy) {
        const [, d, m, y] = dmy;
        const day = Number(d);
        const month = Number(m);
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        }
    }

    const parsed = new Date(str);
    if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString().slice(0, 10);
    }
    return null;
}

function parseQuantityCell(raw) {
    if (typeof raw === "number") return raw;
    if (raw === "" || raw === undefined || raw === null) return raw;
    const cleaned = String(raw).replace(/,/g, "").trim();
    if (cleaned === "") return "";
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : raw; // return the original (non-numeric) value so validateActivity reports it correctly
}

/**
 * Resolves the final header -> target map, letting a client-supplied
 * override win over the auto-detected mapping for that header.
 */
function resolveMapping(autoMapping, overrideMapping = {}) {
    const resolved = {};
    for (const header of Object.keys(autoMapping)) {
        const override = overrideMapping[header];
        if (override === "ignore" || override === null) {
            resolved[header] = null;
        } else if (typeof override === "string" && override.length > 0) {
            resolved[header] = override;
        } else {
            resolved[header] = autoMapping[header].target;
        }
    }
    return resolved;
}

/**
 * Builds candidate activity records + validation flags for every mapped
 * (date-column x activity-column) cell in the parsed rows. Does NOT touch
 * the database — used by both previewUpload() and commitUpload().
 */
function buildCandidateRecords({ companyId, headers, rows, resolvedMapping, autoMapping }) {
    const dateHeader = headers.find((h) => resolvedMapping[h] === "date");
    const activityHeaders = headers.filter((h) => ACTIVITY_TARGETS.has(resolvedMapping[h]));

    if (!dateHeader) {
        throw new IngestError('No "date" column was detected or selected. Please map one column to Date before importing.');
    }
    if (activityHeaders.length === 0) {
        throw new IngestError("No recognizable activity columns (electricity, diesel, petrol, waste) were detected or selected.");
    }

    const records = [];
    rows.forEach((row, rowIndex) => {
        const rawDate = row[dateHeader];
        const date = normalizeDateValue(rawDate);

        for (const header of activityHeaders) {
            const rawQuantity = row[header];
            if (rawQuantity === "" || rawQuantity === undefined || rawQuantity === null) {
                continue; // blank cell for this activity on this row: nothing to import, not an error
            }

            const type = resolvedMapping[header];
            const unit = autoMapping[header]?.unitHint || DEFAULT_UNIT_BY_TYPE[type];
            const quantity = parseQuantityCell(rawQuantity);

            // Mirror routes/activities.js exactly: normalize against the
            // typed value, but validate against the raw/original shape so
            // a non-numeric cell is reported accurately.
            const normalized = normalizeUnits({ date, type, unit, quantity });
            const flags = validateActivity({ date, type, quantity, unit });
            if (!date && rawDate !== "" && rawDate !== undefined) {
                flags.unshift(`row ${rowIndex + 2}: could not parse date value "${rawDate}"`);
            } else if (!date) {
                flags.unshift(`row ${rowIndex + 2}: missing date`);
            }

            const hasBlockingError = flags.some(
                (f) => f.startsWith("missing required field") || f.startsWith("quantity must")
            );

            records.push({
                sourceHeader: header,
                sourceRow: rowIndex + 2, // +1 for header row, +1 for 1-indexing -> matches spreadsheet row number
                date,
                type,
                quantity: normalized.quantity,
                rawQuantity,
                unit: normalized.unit || unit,
                flags,
                status: hasBlockingError ? "error" : flags.length > 0 ? "warning" : "ok",
            });
        }
    });

    return records;
}

/**
 * Step 1 (POST /api/upload): parse the file, auto-detect columns, validate
 * every candidate row, and persist a "review" upload so the browser can
 * confirm/edit the mapping without re-sending the file.
 */
function previewUpload({ companyId, filename, buffer }) {
    let parsed;
    try {
        parsed = parseSpreadsheet(buffer, filename);
    } catch (err) {
        if (err instanceof ParseError) throw new IngestError(err.message, 400);
        throw err;
    }

    const { headers, rows, warnings } = parsed;
    const autoMapping = detectColumns(headers);
    const resolvedMapping = resolveMapping(autoMapping);

    const fileHash = hashBuffer(buffer);
    const duplicateOf = findCommittedUploadByHash(companyId, fileHash);

    let records = [];
    let pipelineWarning = null;
    try {
        records = buildCandidateRecords({ companyId, headers, rows, resolvedMapping, autoMapping });
    } catch (err) {
        if (err instanceof IngestError) {
            // Still let the user see the raw headers/mapping so they can
            // fix it manually (e.g. no date column auto-detected), instead
            // of a dead-end error page.
            pipelineWarning = err.message;
        } else {
            throw err;
        }
    }

    const rowsValid = records.filter((r) => r.status === "ok").length;
    const rowsFlagged = records.filter((r) => r.status === "warning").length;
    const rowsError = records.filter((r) => r.status === "error").length;

    const uploadRow = insertUpload({
        company_id: companyId,
        original_filename: filename,
        file_hash: fileHash,
        status: "review",
        mapping_json: JSON.stringify(autoMapping),
        parsed_rows_json: JSON.stringify({ headers, rows }),
        rows_total: records.length,
        rows_valid: rowsValid,
        rows_flagged: rowsFlagged,
    });

    return {
        uploadId: uploadRow.id,
        filename,
        status: "review",
        headers,
        mapping: autoMapping,
        rowsTotal: records.length,
        rowsValid,
        rowsFlagged,
        rowsError,
        preview: records.slice(0, PREVIEW_ROW_LIMIT),
        parserWarnings: warnings,
        pipelineWarning,
        possibleDuplicate: !!duplicateOf,
        duplicateOfUploadId: duplicateOf ? duplicateOf.id : null,
    };
}

/**
 * Step 2 (POST /api/upload/:id/commit): re-runs the same candidate-building
 * logic against the STORED parsed rows (no re-upload needed) using the
 * user-confirmed mapping, then inserts activities + calculation_results
 * inside a single transaction — exactly the same functions
 * routes/activities.js uses for a manually-entered activity.
 */
function commitUpload({ uploadId, companyId, mappingOverride = {}, includeFlagged = true }) {
    const upload = getUploadById(uploadId);
    if (!upload) throw new IngestError(`No upload found with id ${uploadId}`, 404);
    if (upload.company_id !== Number(companyId)) {
        throw new IngestError("This upload does not belong to the given company", 403);
    }
    if (upload.status === "committed") {
        throw new IngestError("This upload has already been imported.", 409);
    }

    const { headers, rows } = JSON.parse(upload.parsed_rows_json);
    const autoMapping = JSON.parse(upload.mapping_json);
    const resolvedMapping = resolveMapping(autoMapping, mappingOverride);

    const records = buildCandidateRecords({ companyId, headers, rows, resolvedMapping, autoMapping });

    const toInsert = records.filter((r) => r.status === "ok" || (r.status === "warning" && includeFlagged));
    const skipped = records.filter((r) => r.status === "error" || (r.status === "warning" && !includeFlagged));

    const factors = getEmissionFactors();
    const inserted = [];

    db.exec("BEGIN");
    try {
        for (const record of toInsert) {
            const flags = [...record.flags];
            const activityRow = insertActivity({
                company_id: companyId,
                date: record.date,
                type: record.type,
                quantity: record.quantity,
                unit: record.unit,
                flags: JSON.stringify(flags),
                upload_id: uploadId,
            });

            let calculation = null;
            try {
                const calculated = calculateEmissions(
                    { type: record.type, quantity: record.quantity, unit: record.unit, date: record.date },
                    factors
                );
                calculation = insertCalculationResult({
                    activity_id: activityRow.id,
                    co2e_kg: calculated.co2e_kg,
                    scope: calculated.scope,
                    factor_used_id: calculated.factor_used_id,
                });
            } catch (calcErr) {
                // Same behavior as routes/activities.js: keep the stored
                // activity even if calculation couldn't run for it.
                flags.push(`calculation skipped: ${calcErr.message}`);
            }

            inserted.push({ activity: { ...activityRow, flags }, calculation, sourceRow: record.sourceRow, sourceHeader: record.sourceHeader });
        }
        db.exec("COMMIT");
    } catch (err) {
        db.exec("ROLLBACK");
        throw err;
    }

    const committedUpload = markUploadCommitted(uploadId, {
        rows_valid: toInsert.filter((r) => r.status === "ok").length,
        rows_flagged: toInsert.filter((r) => r.status === "warning").length,
    });

    return {
        uploadId,
        status: committedUpload.status,
        rowsProcessed: records.length,
        rowsImported: inserted.length,
        rowsSkipped: skipped.length,
        importedActivities: inserted,
        skippedRows: skipped.map((r) => ({ sourceRow: r.sourceRow, sourceHeader: r.sourceHeader, type: r.type, flags: r.flags })),
    };
}

module.exports = { previewUpload, commitUpload, buildCandidateRecords, IngestError };
