export default function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="empty-state">
      {Icon && <Icon size={26} strokeWidth={1.5} />}
      {title && <h3>{title}</h3>}
      {description && <p>{description}</p>}
    </div>
  );
}
