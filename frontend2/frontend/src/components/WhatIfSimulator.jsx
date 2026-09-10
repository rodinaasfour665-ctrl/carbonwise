import { useEffect, useState } from "react";
import { Leaf, Play, SlidersHorizontal, TrendingDown } from "lucide-react";
import CustomSelect from "./ui/CustomSelect";
import KPICard from "./ui/KPICard";
import HotspotRow from "./ui/HotspotRow";
import EmptyState from "./ui/EmptyState";
import Skeleton from "./ui/Skeleton";
import { getResults, runWhatIf } from "../api/client";

const SCENARIOS = [
  { type: "fuel_diesel", label: "Reduce diesel consumption" },
  { type: "electricity", label: "Reduce electricity consumption" },
  { type: "natural_gas", label: "Reduce natural gas consumption" },
  { type: "car_diesel_average", label: "Reduce transportation" },
];

const SCOPE_TONE = { "Scope 1": "scope1", "Scope 2": "scope2", "Scope 3": "scope3" };

function fmtKg(n) {
  return Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export default function WhatIfSimulator({ companyId = 1 }) {
  const [scenario, setScenario] = useState(SCENARIOS[0].type);
  const [reduction, setReduction] = useState(20);
  const [baseline, setBaseline] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getResults(companyId)
      .then(setBaseline)
      .catch(() => {}); // baseline is only used for the "vs today" comparison - fine to skip if it fails
  }, [companyId]);

  async function runSimulation() {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const data = await runWhatIf(companyId, [
        { type: scenario, reductionPct: Number(reduction) },
      ]);
      setResult(data);
    } catch (err) {
      setError(err.message || "Simulation failed");
    } finally {
      setLoading(false);
    }
  }

  const footprint = result?.footprint;
  const baselineTotal = baseline?.totalCo2eKg;
  const newTotal = footprint?.totalCo2eKg;
  const savedKg = baselineTotal != null && newTotal != null ? baselineTotal - newTotal : null;
  const savedPct = baselineTotal ? (savedKg / baselineTotal) * 100 : null;

  const categoryEntries = footprint?.byCategory
    ? Object.entries(footprint.byCategory)
        .map(([category, value]) => ({ category, value: Number(value || 0) }))
        .sort((a, b) => b.value - a.value)
    : [];
  const categoryTotal = categoryEntries.reduce((sum, c) => sum + c.value, 0) || 1;

  const scopeEntries = footprint?.byScope ? Object.entries(footprint.byScope) : [];
  const scenarioLabel = SCENARIOS.find((s) => s.type === scenario)?.label;

  return (
    <div>
      <div className="page-header">
        <span className="kicker">Act</span>
        <h1>What-if scenarios</h1>
        <p>
          Model a reduction in one emission source and see the projected effect on total
          footprint - calculated by CarbonWise's existing what-if engine, not a separate
          estimate.
        </p>
      </div>

      <div className="section-card whatif-panel">
        <div className="whatif-controls">
          <CustomSelect
            id="whatif-scenario"
            label="Scenario"
            value={scenario}
            onChange={setScenario}
            options={SCENARIOS.map((s) => ({ value: s.type, label: s.label }))}
          />

          <div className="field">
            <label htmlFor="whatif-reduction">Reduction</label>
            <div className="whatif-slider-row">
              <input
                id="whatif-reduction"
                type="range"
                min="0"
                max="100"
                step="5"
                value={reduction}
                onChange={(e) => setReduction(Number(e.target.value))}
                className="whatif-slider"
              />
              <span className="whatif-slider-value">{reduction}%</span>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary whatif-run-btn"
            onClick={runSimulation}
            disabled={loading}
          >
            <Play size={15} />
            {loading ? "Calculating..." : "Run simulation"}
          </button>
        </div>

        {error && (
          <div className="error-banner" style={{ marginTop: 18 }}>
            {error}
          </div>
        )}

        {loading && (
          <div style={{ marginTop: 22 }}>
            <Skeleton height={90} style={{ marginBottom: 14 }} />
            <Skeleton height={160} />
          </div>
        )}

        {!loading && !result && !error && (
          <div style={{ marginTop: 10 }}>
            <EmptyState
              icon={SlidersHorizontal}
              title="No simulation run yet"
              description="Pick a scenario and a reduction percentage, then run the simulation to see the projected footprint."
            />
          </div>
        )}

        {!loading && result && footprint && (
          <div className="whatif-results">
            <div className="whatif-results-head">
              <TrendingDown size={15} />
              <span>
                {scenarioLabel} by {reduction}%
              </span>
            </div>

            <div className="kpi-grid whatif-kpi-grid">
              <KPICard
                icon={Leaf}
                label="Projected total CO2e"
                value={fmtKg(newTotal)}
                unit="kg"
                sub={
                  baselineTotal != null
                    ? `vs ${fmtKg(baselineTotal)} kg today`
                    : undefined
                }
                tone="brand"
              />
              <KPICard
                icon={TrendingDown}
                label="Emissions avoided"
                value={savedKg != null ? fmtKg(savedKg) : "—"}
                unit={savedKg != null ? "kg" : undefined}
                sub={savedPct != null ? `${savedPct.toFixed(1)}% lower than today` : undefined}
              />
              {scopeEntries.map(([scopeKey, val]) => (
                <KPICard
                  key={scopeKey}
                  label={scopeKey}
                  value={fmtKg(val)}
                  unit="kg"
                  tone={SCOPE_TONE[scopeKey] || "default"}
                />
              ))}
            </div>

            {categoryEntries.length > 0 && (
              <div className="section-block whatif-category-block">
                <div className="section-block-head">
                  <div>
                    <h2>Projected emissions by source</h2>
                    <p>Category breakdown under this scenario</p>
                  </div>
                </div>
                <div className="hotspot-list">
                  {categoryEntries.map((entry, i) => (
                    <HotspotRow
                      key={entry.category}
                      category={entry.category}
                      valueKg={entry.value}
                      pct={(entry.value / categoryTotal) * 100}
                      delay={i * 80}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
