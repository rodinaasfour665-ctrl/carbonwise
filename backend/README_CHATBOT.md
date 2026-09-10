# Grounded Sustainability Chatbot — Integration Guide

## 1. Copy files into your backend

```
backend/src/chat/contextBuilder.js     (new)
backend/src/chat/whatifDetector.js     (new)
backend/src/chat/llmClient.js          (new)
backend/src/chat/chatEngine.js         (new)
backend/src/chat/manualTest.js         (new, optional — see "Testing" below)
backend/src/routes/chat.js             (new)
backend/src/routes/whatif.js           (REPLACE existing file)
backend/src/server.js                  (REPLACE existing file)
```

`routes/whatif.js` and `server.js` are full replacements, but both are
additive changes only:
- `whatif.js`: the route handler behaves exactly as before; its logic was
  pulled into an exported `runWhatIf()` function (plus a cost comparison)
  so the chatbot can call it directly instead of making an HTTP call to
  itself. `POST /api/whatif` still returns the original `footprint` field,
  with `baselineFootprint`, `costs`, and `baselineCosts` added alongside it.
- `server.js`: two lines added (`require` + `app.use`) to mount `/api/chat`.

All 62 existing backend tests still pass unmodified after these changes.

## 2. (Optional) Enable the real LLM

The chatbot works with **or without** an LLM. If `ANTHROPIC_API_KEY` is not
set, it uses a fully deterministic, template-based grounded engine (see
"How grounding works" below) — no external calls, no risk of hallucination.

To use the real Anthropic API instead:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

No new npm dependency is needed — `llmClient.js` uses Node's built-in
`fetch` to call `https://api.anthropic.com/v1/messages` directly. Default
model is `claude-haiku-4-5-20251001` (fast/cheap, plenty for grounded
Q&A over a small JSON context); change `DEFAULT_MODEL` in `llmClient.js`
to `claude-sonnet-5` if you want stronger reasoning.

If the API call ever fails (missing key, network issue, rate limit, bad
response), the chatbot automatically falls back to the deterministic
engine — it never crashes and never invents an answer.

## 3. Run it

```bash
cd backend
npm start
curl -X POST http://localhost:4000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"companyId":1,"message":"What is our biggest emission source?"}'
```

## 4. Testing

A small manual test script is included that exercises all the required
verification questions against your real seeded data (no server needs to
be manually started — it spins one up in-process):

```bash
cd backend
node src/chat/manualTest.js
```

---

## Files created

- `backend/src/chat/contextBuilder.js` — builds the structured, grounded
  context object for one company (emissions, scope, costs, top sources/
  drivers, recommendations, action plan) by calling the existing engines —
  no calculation logic duplicated.
- `backend/src/chat/whatifDetector.js` — parses "what if" questions
  ("what if we reduce diesel by 20%?") into the exact
  `{ type, reductionPct }` shape `runWhatIf()` expects. A keyword only
  resolves to an activity type that actually exists in the company's data.
- `backend/src/chat/llmClient.js` — thin wrapper around the Anthropic
  Messages API (native `fetch`, no SDK dependency).
- `backend/src/chat/chatEngine.js` — orchestration: builds prompts, calls
  the LLM if configured, and falls back to a deterministic grounded
  template engine otherwise or on any LLM error.
- `backend/src/chat/manualTest.js` — optional manual verification script.
- `backend/src/routes/chat.js` — `POST /api/chat` endpoint.

## Files modified

- `backend/src/routes/whatif.js` — extracted `runWhatIf()` as an exported,
  reusable function (with an added cost comparison); HTTP behavior
  unchanged for existing callers.
- `backend/src/server.js` — registered the `/api/chat` route.

## API added

```
POST /api/chat
Body:  { "companyId": 1, "message": "What is our biggest emission source?" }
Reply: { "companyId": 1, "message": "...", "intent": "biggest_emission_source",
         "source": "llm" | "template", "answer": "..." }
```

## LLM used, if any

Anthropic API (`claude-haiku-4-5-20251001` by default), called directly via
`fetch` — only if `ANTHROPIC_API_KEY` is set in the environment. No SDK was
added to `package.json`. If the key isn't set, the deterministic grounded
engine answers instead — the feature is fully functional either way.

## How grounding works

1. `contextBuilder.js` reads ONLY this company's already-calculated data
   by calling the exact same functions `routes/dashboard.js` calls
   (`calculateCompanyFootprint`, `computeCosts`, `generateRecommendations`,
   `personalizeRecommendations`, `buildActionPlan`) — nothing is
   recalculated or invented.
2. When the LLM is used, it is given a strict system prompt: answer ONLY
   from the JSON context provided, never invent a company-specific number,
   and if the context doesn't contain what's needed, reply with exactly
   `"I don't have enough data to answer this question."`
3. When the LLM is not used (or its call fails), the deterministic engine
   in `chatEngine.js` reads the exact same context object and only ever
   emits numbers pulled directly from it — if a needed field is
   empty/missing, it returns the same fallback sentence. There is no path
   in either mode where a company-specific number can be fabricated.

## How What-if questions are handled

1. `whatifDetector.isWhatIfQuestion()` checks for "what if" / "if we
   reduce/cut/lower/decrease" phrasing.
2. `whatifDetector.detectWhatIf()` extracts a percentage and matches a
   keyword (e.g. "diesel") to an activity type that actually exists in
   this company's data — never a guessed/invented type.
3. The existing What-if Engine (`routes/whatif.js`'s `runWhatIf()`) is
   called with those modifications — the exact same emissions/cost
   calculation logic used by `POST /api/whatif`, nothing new.
4. Only the pre-computed before/after numbers are handed to the LLM (or
   the deterministic template) to phrase in plain English — the LLM never
   performs the calculation itself.

## Tests performed

- Ran the full existing backend suite (`node --test`): **62/62 passing**,
  unchanged.
- Ran `src/chat/manualTest.js` against the real seeded demo data
  (`companyId=1`, Nile Print & Pack) for all required verification
  questions:
  - "What is our biggest emission source?" → correctly identified from
    `topEmissionSources`.
  - "Which scope has the highest emissions?" → correctly identified from
    `scopeBreakdown`.
  - "What should we prioritize?" → correctly matched the top
    `priorityScore` recommendation.
  - "What costs us the most?", "Which recommendation has the shortest
    payback?", "What if we reduce diesel by 20%?" → correctly returned
    `"I don't have enough data to answer this question."` because the
    current demo database only has `natural_gas` activities logged for
    company 1 (no diesel, electricity, or waste records, and no
    cost-priced activity types yet) — **this is correct grounded
    behavior, not a bug**. As soon as you log diesel/electricity/waste
    activities for the company (via the existing `/api/activities` or
    `/api/upload`), those questions will be answered from that real data
    automatically, with no code changes.

---

## Still needed for the frontend

The uploaded `frontend2.zip` only contained `index.html`, `package.json`,
`vite.config.js`, `package-lock.json`, and the built `dist/` output — the
actual `src/` folder (referenced by `index.html` as `/src/main.jsx`) wasn't
in the archive, so I can't see your existing components or styling
conventions yet. To build the chatbot UI in your project's own style,
please upload:

1. `src/main.jsx` and `src/App.jsx` (or your top-level routing/layout file)
2. One existing feature component for style reference — ideally
   `RecommendationCard.jsx` or similar (colors, CSS/Tailwind conventions,
   card layout)
3. Your existing API helper (the file that does `fetch`/`axios` calls to
   the backend), if you have one — otherwise I'll add a small one

Once I have those, I'll build the `CarbonWise Assistant` chat UI (message
list, input box, suggested-question chips) matching your existing design
and wire it to `POST /api/chat`.
