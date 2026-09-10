// backend/test/ingestion.test.js
// Regression tests for the Smart File Upload + Data Ingestion feature.
// Run with: npm test (node --test), same as the rest of backend/test/.

const test = require("node:test");
const assert = require("node:assert/strict");
const XLSX = require("xlsx");

const { parseSpreadsheet, ParseError } = require("../src/ingestion/parseSpreadsheet");
const { detectColumns } = require("../src/ingestion/detectColumns");
const { buildCandidateRecords } = require("../src/ingestion/ingestPipeline");

function csvBuffer(text) {
    return Buffer.from(text, "utf8");
}

function xlsxBuffer(aoa) {
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

// --- parseSpreadsheet.js ---

test("parseSpreadsheet: valid CSV parses headers and rows", () => {
    const buf = csvBuffer("Date,Electricity Consumption,Diesel Used\n2026-07-01,12000,500\n2026-08-01,13500,550\n");
    const result = parseSpreadsheet(buf, "activity.csv");
    assert.deepEqual(result.headers, ["Date", "Electricity Consumption", "Diesel Used"]);
    assert.equal(result.rows.length, 2);
    // CSV has no cell-type info, so this may legitimately be the string
    // "12000" rather than the number 12000 — ingestPipeline.js's
    // parseQuantityCell() coerces it before validation/normalization
    // (see the buildCandidateRecords tests below).
    assert.equal(Number(result.rows[0]["Electricity Consumption"]), 12000);
});

test("parseSpreadsheet: valid XLSX parses headers and rows", () => {
    const buf = xlsxBuffer([
        ["Date", "Electricity", "Diesel"],
        ["2026-07-01", 12000, 500],
    ]);
    const result = parseSpreadsheet(buf, "activity.xlsx");
    assert.deepEqual(result.headers, ["Date", "Electricity", "Diesel"]);
    assert.equal(result.rows.length, 1);
});

test("parseSpreadsheet: empty file throws ParseError", () => {
    assert.throws(() => parseSpreadsheet(Buffer.alloc(0), "empty.csv"), ParseError);
});

test("parseSpreadsheet: headers with no data rows throws ParseError", () => {
    assert.throws(() => parseSpreadsheet(csvBuffer("Date,Electricity\n"), "headers_only.csv"), ParseError);
});

test("parseSpreadsheet: unsupported extension throws ParseError", () => {
    assert.throws(() => parseSpreadsheet(csvBuffer("a,b\n1,2\n"), "activity.pdf"), ParseError);
});

// --- detectColumns.js ---

test("detectColumns: recognizable aliases map with high confidence, no review needed", () => {
    const mapping = detectColumns(["Date", "Electricity Consumption", "Diesel Used", "Waste Generated"]);
    assert.equal(mapping["Date"].target, "date");
    assert.equal(mapping["Electricity Consumption"].target, "electricity");
    assert.equal(mapping["Diesel Used"].target, "fuel_diesel");
    assert.equal(mapping["Waste Generated"].target, "waste_landfill");
    for (const h of ["Date", "Electricity Consumption", "Diesel Used", "Waste Generated"]) {
        assert.equal(mapping[h].requiresReview, false, `${h} should not require review`);
        assert.ok(mapping[h].confidence >= 0.9, `${h} confidence should be high, got ${mapping[h].confidence}`);
    }
});

test("detectColumns: petrol aliases map to fuel_petrol", () => {
    const mapping = detectColumns(["Petrol Consumption"]);
    assert.equal(mapping["Petrol Consumption"].target, "fuel_petrol");
});

test("detectColumns: unrecognized/ambiguous header is NOT auto-mapped and is flagged for review", () => {
    const mapping = detectColumns(["Usage"]);
    assert.equal(mapping["Usage"].target, null);
    assert.equal(mapping["Usage"].requiresReview, true);
    assert.ok(mapping["Usage"].confidence < 0.75);
});

test("detectColumns: completely unknown header gets zero confidence", () => {
    const mapping = detectColumns(["Employee Name"]);
    assert.equal(mapping["Employee Name"].target, null);
    assert.equal(mapping["Employee Name"].requiresReview, true);
});

test("detectColumns: unit hint extracted from header parentheses", () => {
    const mapping = detectColumns(["Electricity (MWh)"]);
    assert.equal(mapping["Electricity (MWh)"].target, "electricity");
    assert.equal(mapping["Electricity (MWh)"].unitHint, "MWh");
});

// --- ingestPipeline.js: buildCandidateRecords (validation + normalization reuse) ---

test("buildCandidateRecords: valid rows normalize units and produce no flags", () => {
    const headers = ["Date", "Electricity Consumption", "Diesel Used"];
    const rows = [{ Date: "2026-07-01", "Electricity Consumption": 12000, "Diesel Used": 500 }];
    const autoMapping = detectColumns(headers);
    const resolvedMapping = { Date: "date", "Electricity Consumption": "electricity", "Diesel Used": "fuel_diesel" };

    const records = buildCandidateRecords({ companyId: 1, headers, rows, resolvedMapping, autoMapping });
    assert.equal(records.length, 2);
    assert.ok(records.every((r) => r.status === "ok"));
    assert.equal(records.find((r) => r.type === "electricity").unit, "kWh");
});

test("buildCandidateRecords: negative quantity is flagged as an error and excluded from import", () => {
    const headers = ["Date", "Electricity Consumption"];
    const rows = [{ Date: "2026-07-01", "Electricity Consumption": -500 }];
    const autoMapping = detectColumns(headers);
    const resolvedMapping = { Date: "date", "Electricity Consumption": "electricity" };

    const records = buildCandidateRecords({ companyId: 1, headers, rows, resolvedMapping, autoMapping });
    assert.equal(records[0].status, "error");
});

test("buildCandidateRecords: implausibly high value is flagged as a warning, not an error (matches validateActivity.js's flag-not-reject rule)", () => {
    const headers = ["Date", "Electricity Consumption"];
    const rows = [{ Date: "2026-07-01", "Electricity Consumption": 999999 }];
    const autoMapping = detectColumns(headers);
    const resolvedMapping = { Date: "date", "Electricity Consumption": "electricity" };

    const records = buildCandidateRecords({ companyId: 1, headers, rows, resolvedMapping, autoMapping });
    assert.equal(records[0].status, "warning");
});

test("buildCandidateRecords: unparseable date is flagged", () => {
    const headers = ["Date", "Electricity Consumption"];
    const rows = [{ Date: "not-a-date", "Electricity Consumption": 100 }];
    const autoMapping = detectColumns(headers);
    const resolvedMapping = { Date: "date", "Electricity Consumption": "electricity" };

    const records = buildCandidateRecords({ companyId: 1, headers, rows, resolvedMapping, autoMapping });
    assert.equal(records[0].status, "error");
    assert.ok(records[0].flags.some((f) => f.includes("could not parse date")));
});

test("buildCandidateRecords: blank activity cell for a row is skipped, not flagged", () => {
    const headers = ["Date", "Electricity Consumption", "Diesel Used"];
    const rows = [{ Date: "2026-07-01", "Electricity Consumption": 12000, "Diesel Used": "" }];
    const autoMapping = detectColumns(headers);
    const resolvedMapping = { Date: "date", "Electricity Consumption": "electricity", "Diesel Used": "fuel_diesel" };

    const records = buildCandidateRecords({ companyId: 1, headers, rows, resolvedMapping, autoMapping });
    assert.equal(records.length, 1); // only electricity produced a record
});

test("buildCandidateRecords: throws a clear error when no date column is mapped", () => {
    const headers = ["Electricity Consumption"];
    const rows = [{ "Electricity Consumption": 100 }];
    const autoMapping = detectColumns(headers);
    const resolvedMapping = { "Electricity Consumption": "electricity" };

    assert.throws(() => buildCandidateRecords({ companyId: 1, headers, rows, resolvedMapping, autoMapping }), /date/i);
});
