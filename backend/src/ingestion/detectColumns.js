// backend/src/ingestion/detectColumns.js
// Smart File Upload — Step 1: map spreadsheet headers to CarbonWise activity
// fields, with a confidence score per header.
//
// Targets are the SAME `type` strings already used by POST /api/activities
// and frontend/src/pages/DataEntry.jsx (see backend/src/engine/mapToScope.js
// and calculateEmissions.js's ACTIVITY_TYPE_TO_FACTOR_ID), plus the special
// pseudo-target "date" for the activity date column. This keeps ingestion
// output compatible with the existing pipeline without inventing a new
// activity schema.

const REVIEW_THRESHOLD = 0.75; // below this, the mapping is NOT auto-applied

// Canonical unit each activity type is normalized to by normalizeUnits.js /
// stored as by activities.js. Used as the default unit when a column has no
// explicit unit hint.
const DEFAULT_UNIT_BY_TYPE = {
    electricity: "kWh",
    fuel_diesel: "litre",
    fuel_petrol: "litre",
    waste_landfill: "kg",
    waste_recycled: "kg",
};

// Alias phrases (already lowercased/normalized form) for each target field.
// Order doesn't matter for matching but phrases are written the way a real
// spreadsheet header would read.
const FIELD_ALIASES = {
    date: ["date", "activity date", "month", "period", "transaction date", "reporting date", "billing date", "billing period"],
    electricity: [
        "electricity",
        "electricity usage",
        "electricity consumption",
        "electricity used",
        "power consumption",
        "power usage",
        "energy used",
        "energy consumption",
        "kwh",
        "elec",
    ],
    fuel_diesel: [
        "diesel",
        "diesel used",
        "diesel consumption",
        "diesel fuel",
        "diesel litres",
        "diesel liters",
        "gasoil",
    ],
    fuel_petrol: [
        "petrol",
        "petrol used",
        "petrol consumption",
        "petrol fuel",
        "gasoline",
        "gasoline used",
        "gasoline consumption",
    ],
    waste_landfill: [
        "waste",
        "waste generated",
        "waste amount",
        "waste quantity",
        "landfill waste",
        "general waste",
        "waste landfill",
    ],
    waste_recycled: ["recycled waste", "waste recycled", "recycling", "recycled"],
};

// Generic, genuinely-ambiguous headers that must NEVER be auto-mapped with
// high confidence even though they share a word with a real alias (Section
// 7 of the ingestion spec: "do not guess dangerously").
const AMBIGUOUS_HEADERS = new Set(["usage", "consumption", "amount", "quantity", "value", "total", "fuel", "fuel consumption", "fuel used"]);

function normalizeHeader(raw) {
    const original = String(raw || "");
    const unitMatch = /\(([^)]+)\)/.exec(original);
    const unitHint = unitMatch ? unitMatch[1].trim() : null; // preserve original casing, e.g. "MWh"

    let s = original.toLowerCase();
    s = s.replace(/\([^)]*\)/g, " "); // strip unit annotation before matching
    s = s.replace(/[_\-/]/g, " ");
    s = s.replace(/[^a-z0-9\s]/g, " ");
    s = s.replace(/\s+/g, " ").trim();
    return { normalized: s, unitHint };
}

function tokens(s) {
    return new Set(s.split(" ").filter(Boolean));
}

function jaccard(setA, setB) {
    if (setA.size === 0 || setB.size === 0) return 0;
    let intersection = 0;
    for (const t of setA) if (setB.has(t)) intersection += 1;
    const union = new Set([...setA, ...setB]).size;
    return union === 0 ? 0 : intersection / union;
}

/**
 * Scores a normalized header against a single target's alias list.
 * @returns {{confidence: number, matchedAlias: string|null}}
 */
function scoreTarget(normalizedHeader, headerTokens, aliases) {
    let best = { confidence: 0, matchedAlias: null };

    for (const alias of aliases) {
        if (normalizedHeader === alias) {
            return { confidence: 0.97, matchedAlias: alias };
        }
    }

    for (const alias of aliases) {
        const aliasPattern = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
        if (aliasPattern.test(normalizedHeader)) {
            const score = 0.9;
            if (score > best.confidence) best = { confidence: score, matchedAlias: alias };
        }
    }

    for (const alias of aliases) {
        const overlap = jaccard(headerTokens, tokens(alias));
        if (overlap <= 0) continue;
        const score = overlap >= 0.5 ? 0.6 + overlap * 0.25 : 0.3 + overlap * 0.5;
        if (score > best.confidence) best = { confidence: Math.min(score, 0.85), matchedAlias: alias };
    }

    return best;
}

/**
 * Detects which CarbonWise field each spreadsheet header most likely maps to.
 *
 * @param {string[]} headers
 * @returns {Record<string, {
 *   target: string|null,
 *   confidence: number,
 *   requiresReview: boolean,
 *   unitHint: string|null,
 *   defaultUnit: string|null,
 *   suggestions: Array<{target: string, confidence: number}>
 * }>}
 */
function detectColumns(headers) {
    const mapping = {};

    for (const header of headers) {
        const { normalized, unitHint } = normalizeHeader(header);
        const headerTokens = tokens(normalized);

        const candidates = [];
        for (const [target, aliases] of Object.entries(FIELD_ALIASES)) {
            const { confidence, matchedAlias } = scoreTarget(normalized, headerTokens, aliases);
            if (confidence > 0) candidates.push({ target, confidence, matchedAlias });
        }

        // Never let a genuinely-ambiguous bare header (e.g. "Usage",
        // "Amount") reach auto-apply confidence, even if it happens to
        // share every token with one alias.
        if (AMBIGUOUS_HEADERS.has(normalized)) {
            for (const c of candidates) c.confidence = Math.min(c.confidence, 0.55);
        }

        candidates.sort((a, b) => b.confidence - a.confidence);
        const best = candidates[0] || { target: null, confidence: 0 };

        const requiresReview = !best.target || best.confidence < REVIEW_THRESHOLD;

        mapping[header] = {
            target: requiresReview ? null : best.target,
            confidence: Math.round((best.confidence || 0) * 100) / 100,
            requiresReview,
            unitHint,
            defaultUnit: best.target ? DEFAULT_UNIT_BY_TYPE[best.target] || null : null,
            // Top suggestion(s) even when not auto-applied, so the frontend
            // can pre-select a dropdown option for the user to confirm.
            suggestions: candidates.slice(0, 3).map((c) => ({ target: c.target, confidence: Math.round(c.confidence * 100) / 100 })),
        };
    }

    return mapping;
}

module.exports = {
    detectColumns,
    DEFAULT_UNIT_BY_TYPE,
    FIELD_ALIASES,
    REVIEW_THRESHOLD,
    normalizeHeader,
};
