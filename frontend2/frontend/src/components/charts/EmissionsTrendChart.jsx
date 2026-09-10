import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import EmptyState from "../ui/EmptyState";
import { TrendingUp } from "lucide-react";

function monthLabel(key) {
  const [year, month] = key.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString(undefined, { month: "short" });
}

export default function EmissionsTrendChart({ byMonth = {} }) {
  const data = Object.entries(byMonth)
    .sort(([a], [b]) => (a > b ? 1 : -1))
    .map(([key, value]) => ({ key, month: monthLabel(key), value: Number(value || 0) }));

  return (
    <div className="chart-card">
      <div className="chart-card-head">
        <div>
          <h3>Emissions over time</h3>
          <p>Monthly CO₂e across all recorded activity</p>
        </div>
      </div>

      {data.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="No monthly data yet"
          description="Add activities across different dates to see a trend."
        />
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={data} margin={{ top: 16, right: 12, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id="emissionsFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1f4d3a" stopOpacity={0.32} />
                <stop offset="100%" stopColor="#1f4d3a" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#e9ede7" vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#6b7570" }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#6b7570" }} width={44} />
            <Tooltip
              formatter={(value) => [`${Number(value).toFixed(1)} kg CO₂e`, "Emissions"]}
              contentStyle={{ borderRadius: 10, border: "1px solid #dde3dc", fontSize: 12.5 }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#1f4d3a"
              strokeWidth={2.5}
              fill="url(#emissionsFill)"
              animationDuration={700}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
