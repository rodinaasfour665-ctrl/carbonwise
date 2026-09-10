import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * A controlled dropdown built from a real <button> + listbox, instead of a
 * native <select>. Two problems this solves for DataEntry's "Activity type"
 * field:
 *   1. It's unambiguous that it's clickable - full-width button, visible
 *      hover/focus/active states, and a chevron that rotates on open.
 *   2. Styling (font, row height, selected-state) is fully controlled
 *      instead of depending on the OS's native <select> popup, which
 *      renders inconsistently (or not at all inside some embedded/preview
 *      webviews) across browsers.
 */
export default function CustomSelect({ id, label, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const current = options.find((o) => o.value === value) || options[0];

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
    <div className="field">
      {label && <label htmlFor={id}>{label}</label>}
      <div className="custom-select" ref={rootRef}>
        <button
          id={id}
          type="button"
          className="custom-select-trigger"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span>{current?.label}</span>
          <ChevronDown size={16} className={open ? "chevron open" : "chevron"} />
        </button>

        {open && (
          <ul className="custom-select-menu" role="listbox">
            {options.map((opt) => (
              <li key={opt.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={opt.value === value}
                  className={`custom-select-option ${opt.value === value ? "selected" : ""}`}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                >
                  {opt.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
