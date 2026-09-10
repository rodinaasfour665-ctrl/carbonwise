export default function ComingSoon({ icon: Icon, title, description }) {
  return (
    <div>
      <div className="page-header">
        <span className="kicker">CarbonWise</span>
        <h1>{title}</h1>
      </div>
      <div className="section-card">
        <div className="coming-soon">
          {Icon && <Icon size={28} strokeWidth={1.5} />}
          <h2>Coming in the next build</h2>
          <p>{description}</p>
        </div>
      </div>
    </div>
  );
}
