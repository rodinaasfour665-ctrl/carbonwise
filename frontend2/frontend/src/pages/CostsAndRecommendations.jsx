import { useEffect, useState } from "react";
import { Wallet, Users, Calendar, Lightbulb } from "lucide-react";
import Skeleton from "../components/ui/Skeleton";
import EmptyState from "../components/ui/EmptyState";
import { getCosts, getRecommendations, updateCostPricing } from "../api/client";

const CATEGORY_LABEL = { electricity: "Electricity", diesel: "Diesel", petrol: "Petrol", waste: "Waste" };

function fmtEGP(n) {
  return `${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} EGP`;
}

function PricingForm({ pricing, companyId, onSaved }) {
  const [values, setValues] = useState(pricing || {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setValues(pricing || {}), [pricing]);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await updateCostPricing(companyId, {
        electricity: Number(values.electricity),
        diesel: Number(values.diesel),
        petrol: Number(values.petrol),
        waste: Number(values.waste),
      });
      onSaved();
    } catch (err) {
      setError(err.message || "Unable to save pricing");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="field-grid" onSubmit={handleSave} style={{ gridTemplateColumns: "repeat(4, 1fr)", display: "grid", gap: 12 }}>
      {Object.keys(CATEGORY_LABEL).map((cat) => (
        <div className="field" key={cat}>
          <label htmlFor={`price-${cat}`}>{CATEGORY_LABEL[cat]} (EGP)</label>
          <input
            id={`price-${cat}`}
            type="number"
            step="0.01"
            min="0"
            value={values[cat] ?? ""}
            onChange={(e) => setValues((v) => ({ ...v, [cat]: e.target.value }))}
          />
        </div>
      ))}
      <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 12 }}>
        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save pricing"}
        </button>
        {error && <span className="error-message">{error}</span>}
      </div>
    </form>
  );
}

function RecommendationRow({ rank, item }) {
  return (
    <article className="recommendation-card">
      <span className="recommendation-rank">{String(rank).padStart(2, "0")}</span>
      <h4>{item.action}</h4>
      <div className="category">{item.category.replaceAll("_", " ")}</div>

      <div className="recommendation-figures" style={{ flexWrap: "wrap", rowGap: 10 }}>
        <div>
          <span>CO₂ reduction / yr</span>
          <strong>{Number(item.co2ReductionKg).toLocaleString(undefined, { maximumFractionDigits: 0 })} kg</strong>
        </div>
        <div>
          <span>Savings / yr</span>
          <strong>{fmtEGP(item.annualSavingsEGP)}</strong>
        </div>
        <div>
          <span>Implementation cost</span>
          <strong>{fmtEGP(item.implementationCostEGP)}</strong>
        </div>
        <div>
          <span>Payback</span>
          <strong>{item.paybackYears === null ? "—" : `${item.paybackYears.toFixed(1)} yr`}</strong>
        </div>
        <span className={`effort-pill ${item.effort}`}>{item.effort} effort</span>
        <span className="effort-pill low" style={{ background: "var(--brand-tint)", color: "var(--brand-dark)" }}>
          priority {item.priorityScore}
        </span>
      </div>
    </article>
  );
}

export default function CostsAndRecommendations({ companyId = 1 }) {
  const [costs, setCosts] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = async () => {
    setError("");
    setLoading(true);
    try {
      const [costData, recData] = await Promise.all([getCosts(companyId), getRecommendations(companyId)]);
      setCosts(costData);
      setRecommendations(Array.isArray(recData?.recommendations) ? recData.recommendations : []);
    } catch (err) {
      setError((err?.message || "Unable to connect to backend") + ". Make sure the CarbonWise backend is running on http://localhost:4000.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  if (loading) {
    return (
      <div>
        <Skeleton height={140} style={{ marginBottom: 24 }} />
        <div className="metric-row">
          <Skeleton height={90} />
          <Skeleton height={90} />
          <Skeleton height={90} />
        </div>
        <Skeleton height={220} />
      </div>
    );
  }

  if (error) {
    return <div className="error-banner">{error}</div>;
  }

  const categoryEntries = Object.entries(costs?.costByCategory || {}).filter(([, v]) => v > 0);
  const monthEntries = Object.entries(costs?.costByMonth || {}).sort(([a], [b]) => (a > b ? 1 : -1));

  return (
    <div>
      <div className="section-block">
        <div className="section-block-head">
          <div>
            <h2>Cost Engine</h2>
            <p>Real EGP cost of your logged activities — observed, annualized, and per employee</p>
          </div>
        </div>

        <div className="metric-row">
          <div className="metric-card">
            <div className="metric-label">
              <Wallet size={14} /> Observed cost
            </div>
            <div className="metric-value">{fmtEGP(costs?.observedCostEGP)}</div>
            <div className="metric-sub">Over the logged data period ({costs?.period?.periodDays} days)</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">
              <Calendar size={14} /> Annualized cost
            </div>
            <div className="metric-value">{fmtEGP(costs?.annualizedCostEGP)}</div>
            <div className="metric-sub">Scaled from the actual data period to a full year</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">
              <Users size={14} /> Cost per employee
            </div>
            <div className="metric-value">
              {costs?.costPerEmployeeEGP === null ? "—" : fmtEGP(costs?.costPerEmployeeEGP)}
            </div>
            <div className="metric-sub">Annualized cost ÷ {costs?.company?.employees ?? "?"} employees</div>
          </div>
        </div>

        <div className="analytics-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="section-card">
            <h3 style={{ fontSize: 15, marginBottom: 12 }}>Cost by category</h3>
            {categoryEntries.length === 0 ? (
              <EmptyState icon={Wallet} title="No priced activity yet" description="Electricity, diesel, petrol and waste activities appear here." />
            ) : (
              <div className="hotspot-list">
                {categoryEntries.map(([cat, val]) => (
                  <div className="hotspot-row" key={cat}>
                    <div className="hotspot-row-head">
                      <div className="name-group">{CATEGORY_LABEL[cat] || cat}</div>
                      <div className="figures">
                        <span>{fmtEGP(val)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="section-card">
            <h3 style={{ fontSize: 15, marginBottom: 12 }}>Cost by month</h3>
            {monthEntries.length === 0 ? (
              <EmptyState icon={Calendar} title="No monthly data yet" description="Log activities to see monthly cost trends." />
            ) : (
              <div className="hotspot-list">
                {monthEntries.map(([month, val]) => (
                  <div className="hotspot-row" key={month}>
                    <div className="hotspot-row-head">
                      <div className="name-group">{month}</div>
                      <div className="figures">
                        <span>{fmtEGP(val)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="section-card" style={{ marginTop: 16 }}>
          <h3 style={{ fontSize: 15, marginBottom: 12 }}>Pricing (EGP per unit)</h3>
          <p style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 14 }}>
            kWh for electricity, litre for diesel/petrol, kg for waste. Overrides apply only to this company.
          </p>
          <PricingForm companyId={companyId} pricing={costs?.pricing} onSaved={refresh} />
        </div>
      </div>

      <div className="section-block">
        <div className="section-block-head">
          <div>
            <h2>Dynamic recommendations</h2>
            <p>Ranked by priority — 40% emissions, 30% savings, 15% cost, 10% difficulty, 5% payback</p>
          </div>
        </div>
        {recommendations.length === 0 ? (
          <div className="section-card">
            <EmptyState icon={Lightbulb} title="No recommendations yet" description="Log a few activities and CarbonWise will suggest ranked reductions." />
          </div>
        ) : (
          <div className="recommendation-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            {recommendations.map((item, i) => (
              <RecommendationRow key={item.type} rank={i + 1} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
