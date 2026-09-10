import { useEffect, useState } from "react";
import { Zap, Fuel, Car, Plane, Train, Recycle, Trash2, Wallet } from "lucide-react";

const META = {
  electricity: { label: "Electricity", icon: Zap, color: "var(--scope2)" },
  fuel_diesel: { label: "Diesel", icon: Fuel, color: "var(--scope1)" },
  fuel_petrol: { label: "Petrol", icon: Fuel, color: "var(--scope1)" },
  business_travel_car: { label: "Business travel — car", icon: Car, color: "var(--scope3)" },
  business_travel_rail: { label: "Business travel — rail", icon: Train, color: "var(--scope3)" },
  business_travel_flight: { label: "Business travel — flight", icon: Plane, color: "var(--scope3)" },
  waste_landfill: { label: "Waste — landfill", icon: Trash2, color: "var(--scope3)" },
  waste_recycled: { label: "Waste — recycled", icon: Recycle, color: "var(--scope2)" },
};

export default function CostDriverRow({ category, valueEGP, pct, delay = 0 }) {
  const [width, setWidth] = useState(0);
  const meta = META[category] || { label: category.replaceAll("_", " "), icon: Wallet, color: "var(--muted)" };
  const Icon = meta.icon;

  useEffect(() => {
    const t = setTimeout(() => setWidth(pct), 60 + delay);
    return () => clearTimeout(t);
  }, [pct, delay]);

  return (
    <div className="hotspot-row">
      <div className="hotspot-row-head">
        <div className="name-group">
          <Icon size={15} color={meta.color} />
          {meta.label}
        </div>
        <div className="figures">
          <span>{valueEGP.toLocaleString(undefined, { maximumFractionDigits: 0 })} EGP/yr</span>
          <span className="pct">{pct.toFixed(0)}%</span>
        </div>
      </div>
      <div className="hotspot-track">
        <div className="hotspot-fill" style={{ width: `${width}%`, background: meta.color }} />
      </div>
    </div>
  );
}
