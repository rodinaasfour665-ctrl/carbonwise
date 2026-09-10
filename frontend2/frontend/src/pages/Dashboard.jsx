import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Plus, Flame, SlidersHorizontal, Download, Leaf } from "lucide-react";
import Skeleton from "../components/ui/Skeleton";
import EmptyState from "../components/ui/EmptyState";
import HotspotRow from "../components/ui/HotspotRow";
import RecommendationCard from "../components/ui/RecommendationCard";
import EmissionsTrendChart from "../components/charts/EmissionsTrendChart";
import ScopeDonutChart from "../components/charts/ScopeDonutChart";

const SCOPE_META = [
  { key: "Scope 1", label: "Scope 1", sub: "Direct emissions", swatch: "var(--scope1)" },
  { key: "Scope 2", label: "Scope 2", sub: "Purchased electricity", swatch: "var(--scope2)" },
  { key: "Scope 3", label: "Scope 3", sub: "Value-chain emissions", swatch: "var(--scope3)" },
];

function AnimatedNumber({ value, decimals = 0 }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const target = Number(value || 0);
    const duration = 700;
    const start = performance.now();
    let frame;
    function tick(now) {
      const progress = Math.min(1, (now - start) / duration);
      setDisplay(target * (1 - Math.pow(1 - progress, 3)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <>{display.toLocaleString(undefined, { maximumFractionDigits: decimals })}</>;
}

export default function Dashboard({ results, recommendations, loading, recommendationsLoading, onNavigate }) {
  if (loading) {
    return (
      <div>
        <Skeleton height={140} style={{ marginBottom: 24 }} />
        <div className="metric-row">
          <Skeleton height={90} />
          <Skeleton height={90} />
          <Skeleton height={90} />
        </div>
        <Skeleton height={300} />
      </div>
    );
  }

  const byCategory = results?.byCategory || {};
  const categoryEntries = Object.entries(byCategory)
    .map(([category, value]) => ({ category, value: Number(value || 0) }))
    .sort((a, b) => b.value - a.value);
  const categoryTotal = categoryEntries.reduce((sum, c) => sum + c.value, 0) || 1;

  const topRecommendations = (recommendations || []).slice(0, 3);
  const flags = results?.flags || [];
  const activityCount = results?.activityCount || 0;
  const qualityScore = activityCount
    ? Math.max(0, Math.round(((activityCount - flags.length) / activityCount) * 100))
    : 100;

  return (
    <div>
      <div className="hero-panel">
        <svg className="hero-contour" viewBox="0 0 400 160" preserveAspectRatio="none">
          <path d="M0,120 C60,90 100,140 160,100 C220,60 260,130 340,90 C370,75 390,85 400,80"
            stroke="#ffffff" strokeWidth="1" fill="none" />
          <path d="M0,90 C60,60 100,110 160,70 C220,30 260,100 340,60 C370,45 390,55 400,50"
            stroke="#ffffff" strokeWidth="1" fill="none" />
        </svg>
        <svg className="hero-mark" viewBox="0 0 100 100" fill="none">
          <circle cx="70" cy="30" r="18" fill="#ffffff" />
          <circle cx="45" cy="50" r="26" fill="#ffffff" />
          <circle cx="75" cy="62" r="14" fill="#ffffff" />
        </svg>
        <div className="hero-text">
          <span className="kicker">Nile Print &amp; Pack · Jan – Jun 2026</span>
          <h1>Here's your carbon footprint at a glance.</h1>
          <p>Every activity you log flows into this number — validated, scoped, and ready to act on.</p>
        </div>
        <div className="hero-figure">
          <div className="value">
            <AnimatedNumber value={results?.totalCo2eKg} decimals={0} />
          </div>
          <div className="unit">kg CO₂e total footprint</div>
        </div>
      </div>

      <div className="metric-row">
        {SCOPE_META.map((scope) => (
          <div className="metric-card" key={scope.key}>
            <div className="metric-label">
              <span className="metric-swatch" style={{ background: scope.swatch }} />
              {scope.label}
            </div>
            <div className="metric-value">
              <AnimatedNumber value={results?.byScope?.[scope.key]} decimals={0} /> kg
            </div>
            <div className="metric-sub">{scope.sub}</div>
          </div>
        ))}
      </div>

      <div className="analytics-grid">
        <EmissionsTrendChart byMonth={results?.byMonth} />
        <ScopeDonutChart byScope={results?.byScope} totalCo2eKg={results?.totalCo2eKg} />
      </div>

      <div className="section-block">
        <div className="section-block-head">
          <div>
            <h2>Top emission hotspots</h2>
            <p>Where your footprint is coming from</p>
          </div>
        </div>
        <div className="section-card">
          {categoryEntries.length === 0 ? (
            <EmptyState
              icon={Flame}
              title="No hotspots yet"
              description="Add an activity to see which categories drive your footprint."
            />
          ) : (
            <div className="hotspot-list">
              {categoryEntries.slice(0, 5).map((entry, i) => (
                <HotspotRow
                  key={entry.category}
                  category={entry.category}
                  valueKg={entry.value}
                  pct={(entry.value / categoryTotal) * 100}
                  delay={i * 80}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="section-block">
        <div className="section-block-head">
          <div>
            <h2>Recommended next actions</h2>
            <p>Prioritized opportunities to cut your footprint</p>
          </div>
        </div>
        {recommendationsLoading ? (
          <div className="recommendation-grid">
            <Skeleton height={150} />
            <Skeleton height={150} />
            <Skeleton height={150} />
          </div>
        ) : topRecommendations.length === 0 ? (
          <div className="section-card">
            <EmptyState
              icon={Leaf}
              title="No recommendations yet"
              description="Log a few activities and CarbonWise will suggest ranked reductions."
            />
          </div>
        ) : (
          <div className="recommendation-grid">
            {topRecommendations.map((item, i) => (
              <RecommendationCard key={`${item.category}-${i}`} rank={i + 1} item={item} />
            ))}
          </div>
        )}
      </div>

      <div className="analytics-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="section-card quality-alert">
          <div className="quality-score">
            <strong>{qualityScore}%</strong>
            <span>Data quality</span>
          </div>
          {flags.length === 0 ? (
            <div className="quality-clean">
              <CheckCircle2 size={16} />
              All clear — no records need review.
            </div>
          ) : (
            <div className="quality-items">
              {flags.slice(0, 2).map((flag, i) => (
                <div className="quality-item" key={i}>
                  <AlertTriangle size={14} />
                  {flag.type?.replaceAll("_", " ")} · {flag.reason}
                </div>
              ))}
              <button className="btn btn-ghost" style={{ width: "fit-content" }} onClick={() => onNavigate("data-quality")}>
                Review data
              </button>
            </div>
          )}
        </div>

        <div className="section-card">
          <h3 style={{ fontSize: 15, marginBottom: 12 }}>Quick actions</h3>
          <div className="quick-actions">
            <button className="quick-action" onClick={() => onNavigate("data-entry")}>
              <Plus size={17} />
              Add activity
            </button>
            <button className="quick-action" onClick={() => onNavigate("hotspots")}>
              <Flame size={17} />
              Review hotspots
            </button>
            <button className="quick-action" onClick={() => onNavigate("whatif")}>
              <SlidersHorizontal size={17} />
              Run what-if
            </button>
            <button className="quick-action" onClick={() => onNavigate("reports")}>
              <Download size={17} />
              Export report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
