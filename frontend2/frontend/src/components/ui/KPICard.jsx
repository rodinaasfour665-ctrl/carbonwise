export default function KPICard({ icon: Icon, label, value, unit, sub, tone = "default" }) {
  return (
    <div className={`kpi-card tone-${tone}`}>
      <div className="kpi-card-top">
        {Icon && (
          <span className="kpi-icon">
            <Icon size={16} />
          </span>
        )}
        <span className="kpi-label">{label}</span>
      </div>
      <div className="kpi-value">
        {value}
        {unit && <span className="kpi-unit">{unit}</span>}
      </div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}
