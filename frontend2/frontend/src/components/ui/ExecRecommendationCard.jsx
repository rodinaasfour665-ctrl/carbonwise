export default function ExecRecommendationCard({ rank, item }) {
  return (
    <article className={`recommendation-card exec-recommendation-card ${rank === 1 ? "top" : ""}`}>
      <span className="recommendation-rank">{String(rank).padStart(2, "0")}</span>
      <h4>{item.action}</h4>
      <div className="category">{item.category?.replaceAll("_", " ")}</div>

      <div className="exec-rec-priority">
        <div className="priority-track">
          <div className="priority-fill" style={{ width: `${Math.min(100, item.priorityScore || 0)}%` }} />
        </div>
        <span>{Number(item.priorityScore || 0).toFixed(0)} priority</span>
      </div>

      <div className="exec-rec-figures">
        <div>
          <span>CO₂ reduction</span>
          <strong>
            {Number(item.co2ReductionKg || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} kg/yr
          </strong>
        </div>
        <div>
          <span>Annual savings</span>
          <strong>
            {Number(item.annualSavingsEGP || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} EGP
          </strong>
        </div>
        <div>
          <span>Payback</span>
          <strong>{item.paybackYears === null ? "—" : `${item.paybackYears.toFixed(1)} yr`}</strong>
        </div>
      </div>

      <span className={`effort-pill ${String(item.effort || "medium").toLowerCase()}`}>
        {item.effort} effort
      </span>
    </article>
  );
}
