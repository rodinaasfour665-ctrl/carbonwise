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
import { Wallet } from "lucide-react";

function monthLabel(key) {
  const [year, month] = key.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString(undefined, { month: "short" });
}

export default function CostTrendChart({ byMonth = {}, currency = "EGP" }) {
  const data = Object.entries(byMonth)
    .sort(([a], [b]) => (a > b ? 1 : -1))
    .map(([key, value]) => ({ key, month: monthLabel(key), value: Number(value || 0) }));

  return (
    <div className="chart-card">
      <div className="chart-card-head">
        <div>
          <h3>Cost over time</h3>
          <p>Monthly spend on priced activity ({currency})</p>
        </div>
      </div>

      {data.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No monthly cost data yet"
          description="Log electricity, diesel, petrol, or waste activity to see a cost trend."
        />
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={data} margin={{ top: 16, right: 12, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id="costFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2aa3c9" stopOpacity={0.32} />
                <stop offset="100%" stopColor="#2aa3c9" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#e9ede7" vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#6b7570" }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#6b7570" }} width={54} />
            <Tooltip
              formatter={(value) => [`${Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })} ${currency}`, "Cost"]}
              contentStyle={{ borderRadius: 10, border: "1px solid #dde3dc", fontSize: 12.5 }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#2aa3c9"
              strokeWidth={2.5}
              fill="url(#costFill)"
              animationDuration={700}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
