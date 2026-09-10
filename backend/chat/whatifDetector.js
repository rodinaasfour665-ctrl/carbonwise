// backend/src/chat/whatifDetector.js
// Grounded Sustainability Chatbot — What-if Question Detector
//
// Parses a natural-language "what if" question into the exact
// { type, reductionPct } modifications[] shape routes/whatif.js's
// runWhatIf() already expects. A keyword only ever resolves to an activity
// type that is actually present in THIS company's activityTypesPresent
// (from contextBuilder.js) — it never invents a modification for a type
// the company has no data for. This keeps the LLM completely out of the
// calculation path: it only ever explains a result the existing What-if
// Engine already produced.

const KEYWORD_TO_CANDIDATE_TYPES = {
    diesel: ["fuel_diesel"],
    petrol: ["fuel_petrol"],
    gasoline: ["fuel_petrol"],
    electricity: ["electricity", "elec_uk_grid"],
    power: ["electricity", "elec_uk_grid"],
    "natural gas": ["fuel_natural_gas", "natural_gas"],
    gas: ["fuel_natural_gas", "natural_gas"],
    waste: ["waste_landfill", "waste_landfill_mixed", "waste_recycled", "waste_recycled_mixed"],
    landfill: ["waste_landfill", "waste_landfill_mixed"],
    recycling: ["waste_recycled", "waste_recycled_mixed"],
    flight: ["business_travel_flight", "transport_flight_domestic"],
    flying: ["business_travel_flight", "transport_flight_domestic"],
    rail: ["business_travel_rail", "transport_rail_national"],
    train: ["business_travel_rail", "transport_rail_national"],
    car: ["business_travel_car", "transport_car_petrol_avg", "transport_car_diesel_avg"],
    driving: ["business_travel_car", "transport_car_petrol_avg", "transport_car_diesel_avg"],
};

const WHATIF_TRIGGER = /\bwhat if\b|\bif we (reduce|cut|lower|decrease)\b/i;
const PERCENT_REGEX = /(\d+(?:\.\d+)?)\s*%|\b(\d+(?:\.\d+)?)\s*percent\b/i;

function isWhatIfQuestion(message) {
    return WHATIF_TRIGGER.test(message);
}

/**
 * @param {string} message
 * @param {string[]} activityTypesPresent - this company's actual activity types
 * @returns {{modifications: Array<{type:string, reductionPct:number}>, unresolvedKeyword: string|null} | null}
 *          null if no percentage was found in the message at all
 */
function detectWhatIf(message, activityTypesPresent) {
    const percentMatch = message.match(PERCENT_REGEX);
    if (!percentMatch) return null;
    const reductionPct = Number(percentMatch[1] || percentMatch[2]);
    if (!Number.isFinite(reductionPct)) return null;

    const lowerMessage = message.toLowerCase();
    const matchedTypes = new Set();
    let matchedKeyword = null;

    for (const [keyword, candidateTypes] of Object.entries(KEYWORD_TO_CANDIDATE_TYPES)) {
        if (lowerMessage.includes(keyword)) {
            const present = candidateTypes.filter((t) => activityTypesPresent.includes(t));
            if (present.length > 0) {
                matchedKeyword = keyword;
                present.forEach((t) => matchedTypes.add(t));
                break; // first matching keyword wins - avoids ambiguous multi-category asks
            }
            matchedKeyword = matchedKeyword || keyword; // keyword recognized but no matching data
        }
    }

    if (matchedTypes.size === 0) {
        return { modifications: [], unresolvedKeyword: matchedKeyword };
    }

    return {
        modifications: [...matchedTypes].map((type) => ({ type, reductionPct })),
        unresolvedKeyword: null,
    };
}

module.exports = { isWhatIfQuestion, detectWhatIf };
