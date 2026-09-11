<div align="center">

# 🌱 CarbonWise

**A carbon accounting & sustainability intelligence platform for SMEs**

Track emissions, understand true energy costs, simulate reduction scenarios, and get a personalized action plan — all in one dashboard.

![Node](https://img.shields.io/badge/Node.js-%3E%3D22.5.0-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white)
![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-6.x-646CFF?logo=vite&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-003B57?logo=sqlite&logoColor=white)
![License](https://img.shields.io/badge/license-ISC-lightgrey)

</div>

---

## 📖 Overview

**CarbonWise** helps a small/medium business turn raw operational data (fuel, electricity, travel, waste…) into a full greenhouse-gas picture — Scope 1, 2, and 3 — and pairs every number with the **cost** it represents in local currency (EGP). On top of that, it ranks concrete reduction actions, lets you simulate "what if we cut diesel by 20%?", and answers questions in plain English through a grounded AI assistant that never invents a number.

Built end-to-end on a demo persona: **Nile Print & Pack**, a Cairo-based printing & packaging SME.

---

## ✨ Key Features

| Feature | What it does |
|---|---|
| 📊 **Executive Dashboard** | Total footprint, scope breakdown, cost overview, and monthly trends at a glance |
| 📝 **Activity Data Entry** | Manual entry form for logging fuel, electricity, transport, and waste activities |
| 📥 **Smart File Upload** | Drag-and-drop CSV/XLSX ingestion with automatic column detection, unit normalization, and a review-before-commit preview |
| 🧮 **Emissions Engine** | Converts every activity into kgCO₂e using traceable, sourced emission factors, and auto-flags questionable data |
| 💰 **Cost Engine** | Translates activities into real EGP spend, with per-company pricing overrides |
| 💡 **Dynamic Recommendations** | Ranks reduction actions by savings, payback period, and priority score |
| 🎯 **Personalized Action Plan** | Buckets recommendations into Quick Wins / Medium Term / Long Term based on the company's own profile |
| 🔮 **What-If Simulator** | Instantly re-calculates emissions & costs under hypothetical reductions, with no data written to the database |
| 🤖 **Grounded Sustainability Assistant** | Chat interface that answers only from the company's real computed data (LLM-optional — falls back to a deterministic engine, never hallucinates) |
| 📄 **Reports & Export** | Generate a downloadable sustainability report |

---

## 🔥 Tracked Activity Types

Every logged activity maps to a sourced emission factor and a GHG Protocol scope:

| Activity | Category | Unit | Scope |
|---|---|---|---|
| Electricity | `electricity` | kWh | Scope 2 |
| Natural Gas | `fuel_natural_gas` | kWh | Scope 1 |
| Diesel | `fuel_diesel` | litre | Scope 1 |
| Petrol | `fuel_petrol` | litre | Scope 1 |
| Company Car — Petrol | `transport_car_petrol_avg` | km | Scope 3 |
| Company Car — Diesel | `transport_car_diesel_avg` | km | Scope 3 |
| Business Rail Travel | `transport_rail_national` | km | Scope 3 |
| Domestic Flights | `transport_flight_domestic` | km | Scope 3 |
| Landfill Waste | `waste_landfill_mixed` | kg | Scope 3 |
| Recycled Waste | `waste_recycled_mixed` | kg | Scope 3 |

Every factor is sourced (UK Gov GHG Conversion Factors 2026) and stored with its origin for full traceability — see `backend/src/data/emission_factors.json`.

---

## 🏗️ Tech Stack

**Backend**
- Node.js + Express (REST API)
- SQLite (`better-sqlite3`) for storage
- Multer for file uploads, `xlsx` for spreadsheet parsing
- Native `fetch` → Anthropic API for the optional LLM assistant

**Frontend**
- React 18 + Vite
- Recharts for data visualization
- lucide-react for icons

---

## 📂 Project Structure

```
carbonwise-team-Final/
├── backend/
│   ├── src/
│   │   ├── server.js            # Express app, route mounting, DB seeding
│   │   ├── engine/               # Unit normalization, validation, CO2e calculation
│   │   ├── costs/                # Cost engine + default EGP pricing
│   │   ├── recommendations/      # Recommendation ranking & personalization
│   │   ├── ingestion/            # CSV/XLSX parsing, column auto-detection
│   │   ├── routes/               # /api/* endpoint handlers
│   │   └── db/                   # SQLite schema + data access layer
│   ├── chat/                     # Grounded sustainability chatbot (context builder, LLM client, engine)
│   ├── test/                     # Backend test suite (node --test)
│   └── data/                     # Emission factors, plausible ranges
├── frontend2/frontend/
│   ├── src/
│   │   ├── pages/                # Dashboard, DataEntry, ActionPlan, Assistant, etc.
│   │   ├── components/           # Charts, layout, upload zone, UI widgets
│   │   └── api/client.js         # API calls to the backend
│   └── vite.config.js
└── data/sample_company.json      # Demo dataset (Nile Print & Pack)
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js ≥ 22.5.0**
- **npm**

### 1. Clone & install

```bash
git clone <your-repo-url>
cd carbonwise-team-Final

# Backend
cd backend
npm install

# Frontend
cd ../frontend2/frontend
npm install
```

### 2. Run the backend

```bash
cd backend
npm start
```

The API starts on **http://localhost:4000** and auto-seeds a demo company ("Nile Print & Pack") plus the emission factors on first run.

### 3. Run the frontend

In a separate terminal:

```bash
cd frontend2/frontend
npm run dev
```

The app opens on **http://localhost:5173** (Vite default) and talks to the backend at `localhost:4000`.

### 4. (Optional) Enable the AI Assistant

By default the chatbot runs on a deterministic, hallucination-free grounded engine. To use the real Anthropic model instead:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

No extra dependency needed — see `backend/README_CHATBOT.md` for full details on how grounding works.

---

## 🔌 API Reference

Base URL: `http://localhost:4000`

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/activities` | Submit a new activity record |
| `GET` | `/api/results?companyId=1` | Full calculated footprint |
| `GET` | `/api/costs?companyId=1` | Cost breakdown |
| `POST` | `/api/costs/pricing` | Set custom EGP pricing |
| `GET` | `/api/recommendations?companyId=1` | Ranked reduction recommendations |
| `GET` | `/api/action-plan?companyId=1` | Personalized action plan |
| `GET` | `/api/dashboard?companyId=1` | Combined executive dashboard payload |
| `POST` | `/api/whatif` | Simulate emissions/cost under hypothetical changes |
| `POST` | `/api/upload` | Upload & preview a CSV/XLSX file (multipart, field `file`) |
| `POST` | `/api/upload/:id/commit` | Commit a reviewed upload as real activities |
| `GET` | `/api/export` | Export a sustainability report |
| `POST` | `/api/chat` | Ask the grounded AI assistant a question |

---

## 🧪 Testing

```bash
cd backend
npm test
```

Runs the full backend suite (`node --test`) covering emissions calculation, cost engine, ingestion, recommendations, and activity validation.

---

## 👥 Team — EcoVision

Built by the EcoVision team as a hackathon project, with feature ownership spanning the calculation engine, cost engine, recommendation engine, dynamic action plan, smart ingestion, executive dashboard, and the grounded AI assistant.

---

## 📄 License

ISC
