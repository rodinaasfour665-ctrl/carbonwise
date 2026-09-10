export default function RecommendationCard({ rank, item, impact }) {
  return (
    <article className={`recommendation-card ${rank === 1 ? "top" : ""}`}>
      <span className="recommendation-rank">{String(rank).padStart(2, "0")}</span>
      <h4>{item.action}</h4>
      <div className="category">{item.category.replaceAll("_", " ")}</div>

      <div className="recommendation-figures">
        <div>
          <span>Potential reduction</span>
          <strong>
            {Number(item.estimatedReductionKg || 0).toLocaleString(undefined, {
              maximumFractionDigits: 0,
            })}{" "}
            kg
          </strong>
        </div>
        <span className={`effort-pill ${String(item.effort || "medium").toLowerCase()}`}>
          {item.effort} effort
        </span>
      </div>
    </article>
  );
}
