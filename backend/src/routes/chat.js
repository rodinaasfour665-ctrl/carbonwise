// backend/src/routes/chat.js
// Grounded Sustainability Chatbot
//   POST /api/chat  { companyId, message } -> { companyId, message, intent, source, answer }
//
// Flow: build structured context (contextBuilder.js, reuses the exact same
// engines routes/dashboard.js already calls) -> if the question is a
// "what if" question, resolve it through the EXISTING What-if Engine
// (routes/whatif.js's runWhatIf()) - never recalculated by the LLM -> for
// every question, answer using ONLY that context, via the configured LLM
// if ANTHROPIC_API_KEY is set, otherwise via a deterministic grounded
// template engine (chatEngine.js).

const express = require("express");
const router = express.Router();

const { buildChatContext } = require("../chat/contextBuilder");
const { answerQuestion } = require("../chat/chatEngine");

router.post("/", async (req, res) => {
    try {
        const { companyId, message } = req.body || {};

        if (!companyId) {
            return res.status(400).json({ error: "companyId is required" });
        }
        if (!message || typeof message !== "string" || !message.trim()) {
            return res.status(400).json({ error: "message is required" });
        }

        const context = buildChatContext(companyId);
        if (!context) {
            return res.status(404).json({ error: `no company found for companyId ${companyId}` });
        }

        const { answer, intent, source } = await answerQuestion(context, message);

        res.json({ companyId: Number(companyId), message, intent, source, answer });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
