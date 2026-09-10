// frontend/src/pages/ExecutiveDashboard.jsx
// Feature: Executive Dashboard
//
// Every number on this page comes from GET /api/dashboard, which itself
// only reshapes the output of the EXISTING emission/cost/recommendation/
// action-plan engines (see backend/src/routes/dashboard.js). Nothing here
// is hardcoded or recalculated on the frontend - add an activity (manual
// entry, upload, or otherwise) and this page reflects it on next refresh.

import { useCallback, useEffect, useState } from "react";
import {
  Leaf,
  Wallet,
  Coins,
  Users,
  Flame,
  ListChecks,
  Zap,
} from "lucide-react";

import Skeleton from "../components/ui/Skeleton";
import EmptyState from "../components/ui/EmptyState";
import KPICard from "../components/ui/KPICard";
import HotspotRow from "../components/ui/HotspotRow";
import CostDriverRow from "../components/ui/CostDriverRow";
import ExecRecommendationCard from "../components/ui/ExecRecommendationCard";
import EmissionsTrendChart from "../components/charts/EmissionsTrendChart";
import ScopeDonutChart from "../components/charts/ScopeDonutChart";
import CostTrendChart from "../components/charts/CostTrendChart";
import { getDashboard } from "../api/client";

function fmt(n, decimals = 0) {
  return Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: decimals });
}

export default function ExecutiveDashboard({ companyId = 1 }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const result = await getDashboard(companyId);
      setData(result);
    } catch (err) {
      setError(err.message || "Unable to load the dashboard.");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <span className="kicker">Executive summary</span>
          <h1>Executive Dashboard</h1>
        </div>
        <div className="kpi-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} height={92} />
          ))}
        </div>
        <Skeleton height={300} style={{ marginTop: 16 }} />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="page-header">
          <span className="kicker">Executive summary</span>
          <h1>Executive Dashboard</h1>
        </div>
        <div className="error-banner">{error}</div>
      </div>
    );
  }

  const k = data?.kpis || {};
  const topSources = data?.topEmissionSources || [];
  const topDrivers = data?.topCostDrivers || [];
  const topRecs = data?.topRecommendations || [];
  const plan = data?.actionPlanSummary || {};
  const sourcesTotal = topSources.reduce((s, e) => s + e.value, 0) || 1;
  const driversTotal = topDrivers.reduce((s, e) => s + e.value, 0) || 1;

  return (
    <div>
      <div className="page-header">
        <span className="kicker">Executive summary</span>
        <h1>Executive Dashboard</h1>
        <p>
          {data?.company?.name} · {data?.company?.sector} · {data?.activityCount || 0} logged activities
        </p>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <KPICard icon={Leaf} label="Total CO₂e" value={fmt(k.totalCo2eKg)} unit="kg" tone="brand" />
        <KPICard icon={Wallet} label="Total Cost" value={fmt(k.totalCostEGP)} unit="EGP" />
        <KPICard icon={Coins} label="Annualized Cost" value={fmt(k.annualizedCostEGP)} unit="EGP" />
        <KPICard
          icon={Users}
          label="CO₂e / Employee"
          value={k.co2ePerEmployeeKg === null ? "—" : fmt(k.co2ePerEmployeeKg, 1)}
          unit={k.co2ePerEmployeeKg === null ? "" : "kg"}
        />
        <KPICard
          icon={Users}
          label="Cost / Employee"
          value={k.costPerEmployeeEGP === null ? "—" : fmt(k.costPerEmployeeEGP)}
          unit={k.costPerEmployeeEGP === null ? "" : "EGP"}
        />
        <KPICard icon={Zap} label="Scope 1" value={fmt(k.scope1Kg)} unit="kg" tone="scope1" />
        <KPICard icon={Zap} label="Scope 2" value={fmt(k.scope2Kg)} unit="kg" tone="scope2" />
        <KPICard icon={Zap} label="Scope 3" value={fmt(k.scope3Kg)} unit="kg" tone="scope3" />
      </div>

      {/* Emissions Overview */}
      <div className="section-block">
        <div className="section-block-head">
          <div>
            <h2>Emissions overview</h2>
            <p>Footprint by scope and over time</p>
          </div>
        </div>
        <div className="analytics-grid">
          <EmissionsTrendChart byMonth={data?.monthlyCo2eTrend} />
          <ScopeDonutChart byScope={data?.emissionsByScope} totalCo2eKg={k.totalCo2eKg} />
        </div>
      </div>

      {/* Cost Overview */}
      <div className="section-block">
        <div className="section-block-head">
          <div>
            <h2>Cost overview</h2>
            <p>Spend trend on priced activity categories</p>
          </div>
        </div>
        <CostTrendChart byMonth={data?.monthlyCostTrend} currency={data?.currency} />
      </div>

      {/* Top Sources / Drivers */}
      <div className="analytics-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="section-block" style={{ marginBottom: 0 }}>
          <div className="section-block-head">
            <div>
              <h2>Top emission sources</h2>
            </div>
          </div>
          <div className="section-card">
            {topSources.length === 0 ? (
              <EmptyState icon={Flame} title="No emissions yet" description="Log an activity to see hotspots." />
            ) : (
              <div className="hotspot-list">
                {topSources.map((e, i) => (
                  <HotspotRow key={e.key} category={e.key} valueKg={e.value} pct={(e.value / sourcesTotal) * 100} delay={i * 80} />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="section-block" style={{ marginBottom: 0 }}>
          <div className="section-block-head">
            <div>
              <h2>Top cost drivers</h2>
            </div>
          </div>
          <div className="section-card">
            {topDrivers.length === 0 ? (
              <EmptyState icon={Wallet} title="No priced activity yet" description="Electricity, diesel, petrol, or waste activity will show here." />
            ) : (
              <div className="hotspot-list">
                {topDrivers.map((e, i) => (
                  <CostDriverRow key={e.key} category={e.key} valueEGP={e.value} pct={(e.value / driversTotal) * 100} delay={i * 80} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recommendations & ROI */}
      <div className="section-block">
        <div className="section-block-head">
          <div>
            <h2>Recommendations &amp; ROI</h2>
            <p>Ranked by priority score — emissions, savings, cost, difficulty, payback</p>
          </div>
        </div>
        {topRecs.length === 0 ? (
          <div className="section-card">
            <EmptyState icon={Leaf} title="No recommendations yet" description="Log a few activities to get ranked reduction opportunities." />
          </div>
        ) : (
          <div className="recommendation-grid">
            {topRecs.map((item, i) => (
              <ExecRecommendationCard key={`${item.type}-${i}`} rank={i + 1} item={item} />
            ))}
          </div>
        )}
      </div>

      {/* Action Plan Summary */}
      <div className="section-block">
        <div className="section-block-head">
          <div>
            <h2>Action plan summary</h2>
            <p>{plan.totalActions || 0} actions bucketed by implementation timeline</p>
          </div>
        </div>
        <div className="action-plan-summary-grid">
          <div className="action-plan-summary-card">
            <span className="count">{plan.quickWins || 0}</span>
            <span className="label">Quick wins</span>
            <span className="sub">0–3 months</span>
          </div>
          <div className="action-plan-summary-card">
            <span className="count">{plan.mediumTerm || 0}</span>
            <span className="label">Medium term</span>
            <span className="sub">3–12 months</span>
          </div>
          <div className="action-plan-summary-card">
            <span className="count">{plan.longTerm || 0}</span>
            <span className="label">Long term</span>
            <span className="sub">1–5 years</span>
          </div>
        </div>
        {plan.topQuickWin && (
          <div className="section-card" style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 14 }}>
            <ListChecks size={18} color="var(--brand)" />
            <div>
              <strong style={{ fontSize: 13.5 }}>Top quick win: </strong>
              <span style={{ fontSize: 13.5, color: "var(--ink-soft)" }}>{plan.topQuickWin.title}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
