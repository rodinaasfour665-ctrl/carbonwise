import {
  LayoutDashboard,
  Gauge,
  PlusCircle,
  TrendingUp,
  Lightbulb,
  SlidersHorizontal,
  ShieldCheck,
  ListTree,
  FileDown,
  Wallet,
  UploadCloud,
  ListChecks,
  Bot,
} from "lucide-react";

const NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      { id: "executive-dashboard", label: "Executive dashboard", icon: Gauge },
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { id: "data-entry", label: "Data entry", icon: PlusCircle },
      { id: "upload", label: "Upload data", icon: UploadCloud },
    ],
  },
  {
    label: "Analyze",
    items: [
      { id: "trends", label: "Trends", icon: TrendingUp },
    ],
  },
  {
    label: "Act",
    items: [
      { id: "costs", label: "Costs", icon: Wallet },
      { id: "recommendations", label: "Recommendations", icon: Lightbulb },
      { id: "action-plan", label: "Action plan", icon: ListChecks },
      { id: "whatif", label: "What-if scenarios", icon: SlidersHorizontal },
    ],
  },
  {
    label: "Ask",
    items: [{ id: "assistant", label: "CarbonWise Assistant", icon: Bot }],
  },
  {
    label: "Data",
    items: [
      { id: "data-quality", label: "Data quality", icon: ShieldCheck },
      { id: "activity-history", label: "Activity history", icon: ListTree },
    ],
  },
  {
    label: "Reporting",
    items: [{ id: "reports", label: "Reports & export", icon: FileDown }],
  },
];

export default function Sidebar({ page, onNavigate, connected, open }) {
  return (
    <nav className={`sidebar ${open ? "open" : ""}`} aria-label="Main navigation">
      <div className="sidebar-brand">
        <div className="sidebar-mark">CW</div>
        <strong>CarbonWise</strong>
      </div>

      {NAV_GROUPS.map((group) => (
        <div className="nav-group" key={group.label}>
          <div className="nav-group-label">{group.label}</div>
          {group.items.map((item) => {
            const Icon = item.icon;
            const active = page === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`nav-item ${active ? "active" : ""}`}
                aria-current={active ? "page" : undefined}
                onClick={() => onNavigate(item.id)}
              >
                <Icon size={16} />
                {item.label}
              </button>
            );
          })}
        </div>
      ))}

      <div className="sidebar-footer">
        <span className={`status-dot ${connected ? "" : "offline"}`} />
        {connected ? "System connected" : "System offline"}
      </div>
    </nav>
  );
}
