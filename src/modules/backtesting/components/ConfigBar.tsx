import type { ReactNode } from "react";

export interface ConfigChip {
  label: string;
  tone?: "key" | "default" | "warn";
}

interface ConfigBarProps {
  chips: ConfigChip[];
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  /** Rechts in der Kopfzeile, z. B. der Analysieren-Knopf im offenen Zustand. */
  action?: ReactNode;
}

/**
 * Steuerleiste, die nach dem Rechnen zu einer Chip-Zeile zusammenklappt.
 * Vorher hat das Formular dauerhaft das obere Drittel der Seite belegt.
 */
export function ConfigBar({ chips, open, onToggle, children, action }: ConfigBarProps) {
  return (
    <div className="bt-configbar">
      <div className="bt-configbar__summary">
        <button
          type="button"
          className="bt-configbar__toggle"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls="bt-config-body"
        >
          <span className={`bt-configbar__caret ${open ? "is-open" : ""}`} aria-hidden="true">
            ▶
          </span>
          Konfiguration
        </button>
        {!open && (
          <div className="bt-chips">
            {chips.map((c, i) => (
              <span
                key={`${c.label}-${i}`}
                className={`bt-chip ${c.tone === "key" ? "bt-chip--key" : ""} ${
                  c.tone === "warn" ? "bt-chip--warn" : ""
                }`}
              >
                {c.label}
              </span>
            ))}
          </div>
        )}
        {open && <div className="bt-chips" />}
        {action}
      </div>
      {open && (
        <div className="bt-configbar__body" id="bt-config-body">
          {children}
        </div>
      )}
    </div>
  );
}
