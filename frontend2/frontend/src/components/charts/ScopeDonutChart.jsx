import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const SCOPE_HEX = {
  "Scope 1": "#3d5a3f",
  "Scope 2": "#1e8f6f",
  "Scope 3": "#4c7a93",
};

function kg(value) {
  return `${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} kg`;
}

export default function ScopeDonutChart({ byScope = {}, totalCo2eKg = 0 }) {
  const data = Object.entries(byScope).map(([scope, value]) => ({
    scope,
    value: Number(value || 0),
  }));
  const total = totalCo2eKg || data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="chart-card">
      <div className="chart-card-head">
        <div>
          <h3>Scope distribution</h3>
          <p>Share of total footprint</p>
        </div>
      </div>

      <div className="donut-wrap">
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="scope"
              innerRadius={62}
              outerRadius={86}
              paddingAngle={2}
              animationDuration={700}
            >
              {data.map((d) => (
                <Cell key={d.scope} fill={SCOPE_HEX[d.scope] || "#9aa79f"} stroke="none" />
              ))}
            </Pie>
            <Tooltip formatter={(value, name) => [kg(value), name]} />
          </PieChart>
        </ResponsiveContainer>
        <div className="donut-center">
          <strong>{Number(total).toLocaleString(undefined, { maximumFractionDigits: 1 })}</strong>
          <span>kg CO₂e</span>
        </div>
      </div>

      <div className="scope-legend">
        {data.map((d) => (
          <div className="scope-legend-row" key={d.scope}>
            <span className="dot" style={{ background: SCOPE_HEX[d.scope] || "#9aa79f" }} />
            <span className="name">{d.scope}</span>
            <span className="pct">{total ? ((d.value / total) * 100).toFixed(1) : "0.0"}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
