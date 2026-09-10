// backend/src/ingestion/parseSpreadsheet.js
// Smart File Upload — Step 0: raw file -> normalized intermediate representation.
//
// Reads a CSV or XLSX file buffer and returns:
//   { headers: string[], rows: Array<Record<string, any>>, warnings: string[] }
//
// This module does NOT touch the database and does NOT know anything about
// CarbonWise activity types — it only turns bytes into rows/columns. Column
// detection happens in detectColumns.js, and everything from there on is
// orchestrated by ingestPipeline.js.
//
// Uploaded spreadsheets are treated as untrusted input: we only ever read
// cell values (cellFormula/cellHTML disabled) so a malicious formula in a
// cell is never evaluated.

const XLSX = require("xlsx");

const SUPPORTED_EXTENSIONS = [".csv", ".xlsx", ".xls"];

class ParseError extends Error {}

function getExtension(filename = "") {
    const match = /\.[^.]+$/.exec(filename.toLowerCase());
    return match ? match[0] : "";
}

/**
 * @param {Buffer} buffer - raw uploaded file contents
 * @param {string} filename - original filename (used to pick a parse strategy and for error messages)
 * @returns {{ headers: string[], rows: Array<Record<string, any>>, warnings: string[] }}
 */
function parseSpreadsheet(buffer, filename) {
    if (!buffer || buffer.length === 0) {
        throw new ParseError("The uploaded file is empty.");
    }

    const extension = getExtension(filename);
    if (!SUPPORTED_EXTENSIONS.includes(extension)) {
        throw new ParseError(
            `Unsupported file type "${extension || "unknown"}". Only .csv and .xlsx files are supported.`
        );
    }

    let workbook;
    try {
        // cellFormula/cellHTML: false + raw values only — we never evaluate
        // formulas or execute embedded content from the untrusted file.
        workbook = XLSX.read(buffer, {
            type: "buffer",
            cellFormula: false,
            cellHTML: false,
            raw: true,
        });
    } catch (err) {
        throw new ParseError(`Could not parse "${filename}". The file may be corrupted or not a real ${extension} file.`);
    }

    const sheetName = workbook.SheetNames && workbook.SheetNames[0];
    if (!sheetName) {
        throw new ParseError(`"${filename}" does not contain any worksheets.`);
    }
    const sheet = workbook.Sheets[sheetName];

    // First pass: raw header row (array form) so we preserve column order
    // and can catch "no headers at all" as a distinct error.
    const headerRows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, blankrows: false });
    if (!headerRows || headerRows.length === 0) {
        throw new ParseError(`"${filename}" appears to be empty (no rows found).`);
    }

    const rawHeaders = headerRows[0].map((h) => (h === undefined || h === null ? "" : String(h).trim()));
    const headers = rawHeaders.filter((h) => h !== "");
    if (headers.length === 0) {
        throw new ParseError(`"${filename}" has no column headers in the first row.`);
    }

    const warnings = [];
    if (headers.length !== rawHeaders.length) {
        warnings.push("One or more blank column headers were ignored.");
    }

    // Second pass: rows as objects keyed by header, skipping fully-blank rows.
    const objectRows = XLSX.utils.sheet_to_json(sheet, {
        header: rawHeaders,
        range: 1,
        raw: true,
        defval: "",
        blankrows: false,
    });

    const rows = objectRows
        .map((row) => {
            const cleaned = {};
            for (const h of headers) {
                cleaned[h] = row[h] === undefined ? "" : row[h];
            }
            return cleaned;
        })
        .filter((row) => headers.some((h) => String(row[h]).trim() !== ""));

    if (rows.length === 0) {
        throw new ParseError(`"${filename}" has headers but no data rows.`);
    }

    return { headers, rows, warnings };
}

module.exports = { parseSpreadsheet, ParseError, SUPPORTED_EXTENSIONS };
