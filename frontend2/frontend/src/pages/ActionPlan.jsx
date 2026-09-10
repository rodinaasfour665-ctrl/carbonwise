import { useEffect, useState } from "react";
import { Rocket, CalendarClock, Hourglass } from "lucide-react";
import Skeleton from "../components/ui/Skeleton";
import EmptyState from "../components/ui/EmptyState";
import { getActionPlan } from "../api/client";

function fmtEGP(n) {
  return `${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} EGP`;
}

const TIMELINE_SECTIONS = [
  { key: "quickWins", label: "Quick Wins", sub: "0–3 months", icon: Rocket },
  { key: "mediumTerm", label: "Medium Term", sub: "3–12 months", icon: CalendarClock },
  { key: "longTerm", label: "Long Term", sub: "1–5 years", icon: Hourglass },
];

function ActionCard({ action }) {
  const tags = [];
  if (action.isMajorEmissionSource) tags.push("Major emission source");
  if (action.isMajorCostDriver) tags.push("Major cost driver");

  return (
    <article className="recommendation-card">
      <span className="recommendation-rank">{action.priorityScore}</span>
      <h4>{action.title}</h4>
      <div className="category">{action.category.replaceAll("_", " ")}</div>

      {tags.length > 0 && (
        <div
          style={{
            fontSize: 11.5,
            fontWeight: 600,
            color: "var(--brand-dark)",
            marginBottom: 8,
          }}
        >
          {tags.join(" · ")}
        </div>
      )}

      <div className="recommendation-figures" style={{ flexWrap: "wrap", rowGap: 10 }}>
        <div>
          <span>CO₂ reduction / yr</span>
          <strong>{Number(action.co2ReductionKg).toLocaleString(undefined, { maximumFractionDigits: 0 })} kg</strong>
        </div>
        <div>
          <span>Savings / yr</span>
          <strong>{fmtEGP(action.annualSavingsEGP)}</strong>
        </div>
        <div>
          <span>Implementation cost</span>
          <strong>{fmtEGP(action.implementationCostEGP)}</strong>
        </div>
        <div>
          <span>Payback</span>
          <strong>{action.paybackMonths === null ? "—" : `${action.paybackMonths.toFixed(1)} mo`}</strong>
        </div>
        <span className={`effort-pill ${action.effort}`}>{action.effort} effort</span>
        <span
          className="effort-pill low"
          style={{ background: "var(--brand-tint)", color: "var(--brand-dark)" }}
        >
          priority {action.priorityScore}
        </span>
      </div>
    </article>
  );
}

export default function ActionPlan({ companyId = 1 }) {
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    getActionPlan(companyId)
      .then((data) => {
        if (active) setPlan(data);
      })
      .catch((err) => {
        if (active) {
          setError(
            (err?.message || "Unable to connect to backend") +
              ". Make sure the CarbonWise backend is running on http://localhost:4000."
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [companyId]);

  if (loading) {
    return (
      <div>
        <Skeleton height={80} style={{ marginBottom: 24 }} />
        <Skeleton height={220} style={{ marginBottom: 24 }} />
        <Skeleton height={220} style={{ marginBottom: 24 }} />
        <Skeleton height={220} />
      </div>
    );
  }

  if (error) {
    return <div className="error-banner">{error}</div>;
  }

  return (
    <div>
      <div className="page-header">
        <span className="kicker">Act</span>
        <h1>Action plan</h1>
        <p>
          {plan?.company?.name}'s recommendations, grouped into a practical timeline and ranked
          by how much they matter to this company's actual emission and cost profile
          ({plan?.company?.sector}, {plan?.company?.employees} employees).
        </p>
      </div>

      {TIMELINE_SECTIONS.map((section) => {
        const items = plan?.[section.key] || [];
        const Icon = section.icon;
        return (
          <div className="section-block" key={section.key}>
            <div className="section-block-head">
              <div>
                <h2>{section.label}</h2>
                <p>{section.sub}</p>
              </div>
            </div>

            {items.length === 0 ? (
              <div className="section-card">
                <EmptyState
                  icon={Icon}
                  title="No actions in this timeline"
                  description="Log more activity data and CarbonWise will populate this timeline."
                />
              </div>
            ) : (
              <div className="recommendation-grid">
                {items.map((action) => (
                  <ActionCard key={action.recommendationId} action={action} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
