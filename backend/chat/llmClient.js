// backend/src/chat/llmClient.js
// Grounded Sustainability Chatbot — Anthropic API client
//
// Thin wrapper around the Anthropic Messages API (https://api.anthropic.com/v1/messages).
// Uses Node's built-in fetch (Node >= 18), so no @anthropic-ai/sdk dependency
// is required. Reads the API key from process.env.ANTHROPIC_API_KEY - never
// hardcode a key in source.
//
// This module has ONE job: send a system prompt + user message to Claude and
// return the text reply. It has no knowledge of CarbonWise data - the caller
// (chatEngine.js) is responsible for building a fully-grounded prompt that
// contains only the structured context the model is allowed to use.

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

// Small, fast, inexpensive model - more than enough for grounded Q&A over a
// pre-computed JSON context. Swap to "claude-sonnet-5" if you want stronger
// reasoning over more complex questions.
const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

function isConfigured() {
    return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * @param {object} params
 * @param {string} params.system - system prompt (grounding rules + context JSON)
 * @param {string} params.userMessage - the end user's raw question
 * @param {string} [params.model]
 * @param {number} [params.maxTokens]
 * @returns {Promise<string>} the model's text reply
 */
async function askLLM({ system, userMessage, model = DEFAULT_MODEL, maxTokens = 400 }) {
    if (!isConfigured()) {
        throw new Error("ANTHROPIC_API_KEY is not set");
    }

    const response = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.ANTHROPIC_API_KEY,
            "anthropic-version": ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
            model,
            max_tokens: maxTokens,
            temperature: 0, // deterministic, grounded answers - not creative writing
            system,
            messages: [{ role: "user", content: userMessage }],
        }),
    });

    if (!response.ok) {
        const errText = await response.text().catch(() => "");
        throw new Error(`Anthropic API error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const text = (data.content || [])
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("\n")
        .trim();

    if (!text) {
        throw new Error("Anthropic API returned an empty response");
    }
    return text;
}

module.exports = { askLLM, isConfigured, DEFAULT_MODEL };
