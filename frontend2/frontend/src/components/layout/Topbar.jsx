import { useEffect, useRef, useState } from "react";
import { Menu, ChevronDown, Check } from "lucide-react";

// The dropdown had no <button>, onClick, or open/close state at all before —
// it was a plain <div> styled to look like a dropdown, so clicking it did
// nothing. This is a real, keyboard-and-click-accessible menu now.
const PERIODS = ["2024 reporting period", "2025 reporting period", "2026 reporting period"];

export default function Topbar({ onMenuToggle }) {
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState(PERIODS[PERIODS.length - 1]);
  const rootRef = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <header className="topbar">
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <button
          type="button"
          className="menu-toggle"
          aria-label="Toggle navigation"
          onClick={onMenuToggle}
        >
          <Menu size={20} />
        </button>
        <div className="topbar-company">
          <strong>Nile Print &amp; Pack</strong>
          <span>Printing &amp; packaging</span>
        </div>
      </div>

      <div className="period-dropdown" ref={rootRef}>
        <button
          type="button"
          className="topbar-period"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {period}
          <ChevronDown size={14} className={open ? "chevron open" : "chevron"} />
        </button>

        {open && (
          <ul className="period-menu" role="listbox">
            {PERIODS.map((p) => (
              <li key={p}>
                <button
                  type="button"
                  role="option"
                  aria-selected={p === period}
                  className="period-menu-item"
                  onClick={() => {
                    setPeriod(p);
                    setOpen(false);
                  }}
                >
                  {p}
                  {p === period && <Check size={14} />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </header>
  );
}
