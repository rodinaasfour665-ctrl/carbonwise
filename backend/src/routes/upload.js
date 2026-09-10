// backend/src/routes/upload.js
// Smart File Upload + Data Ingestion
//   POST /api/upload             -> parse + auto-map + validate, returns a preview (nothing written to `activities` yet)
//   POST /api/upload/:id/commit  -> insert the user-confirmed rows as real activities, through the existing engine
//
// Reuses getEmissionFactors/insertActivity/insertCalculationResult (db.js)
// and normalizeUnits/validateActivity/calculateEmissions (engine/*) via
// ingestPipeline.js — no calculation logic is duplicated here.

const express = require("express");
const multer = require("multer");
const router = express.Router();

const { previewUpload, commitUpload, IngestError } = require("../ingestion/ingestPipeline");
const { getCompanyById } = require("../db/db");

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_EXTENSIONS = [".csv", ".xlsx", ".xls"];

const upload = multer({
    storage: multer.memoryStorage(), // never touches disk with an arbitrary path from the client
    limits: { fileSize: MAX_FILE_SIZE_BYTES },
    fileFilter: (req, file, cb) => {
        const ext = /\.[^.]+$/.exec(file.originalname.toLowerCase())?.[0] || "";
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
            return cb(new IngestError(`Unsupported file type "${ext || "unknown"}". Only .csv and .xlsx files are accepted.`));
        }
        cb(null, true);
    },
});

function handleError(err, res) {
    if (err instanceof IngestError) {
        return res.status(err.status || 400).json({ error: err.message });
    }
    if (err && err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: `File is too large. Maximum size is ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB.` });
    }
    // Log full detail server-side only; never leak a raw stack trace to the client.
    console.error("[upload]", err);
    return res.status(500).json({ error: "Something went wrong while processing the file." });
}

router.post("/", (req, res) => {
    upload.single("file")(req, res, (multerErr) => {
        if (multerErr) return handleError(multerErr, res);

        try {
            if (!req.file) {
                return res.status(400).json({ error: "No file was uploaded. Attach a .csv or .xlsx file as 'file'." });
            }

            const companyId = Number(req.body.company_id || req.query.companyId || 1);
            const company = getCompanyById(companyId);
            if (!company) {
                return res.status(404).json({ error: `No company found for companyId ${companyId}` });
            }

            const preview = previewUpload({
                companyId,
                filename: req.file.originalname,
                buffer: req.file.buffer,
            });

            res.status(201).json({ companyId, ...preview });
        } catch (err) {
            handleError(err, res);
        }
    });
});

router.post("/:id/commit", (req, res) => {
    try {
        const uploadId = Number(req.params.id);
        const companyId = Number(req.body.company_id || req.body.companyId || 1);
        const mappingOverride = req.body.mapping || {};
        const includeFlagged = req.body.includeFlagged !== false;

        const result = commitUpload({ uploadId, companyId, mappingOverride, includeFlagged });
        res.status(200).json(result);
    } catch (err) {
        handleError(err, res);
    }
});

module.exports = router;
