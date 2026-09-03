import { useEffect, useRef, useState } from "react";

import type { BacktestingAssumptionItem } from "../../api/types";

const DEFAULT_ASSUMPTIONS: BacktestingAssumptionItem[] = [
  { key: "rte", label: "Round-Trip-Effizienz", value: "0,95–0,97" },
  {
    key: "dod",
    label: "Depth of Discharge (DoD)",
    value: "0,90–0,95 → nutzbare Kapazität < Nennkapazität",
  },
  {
    key: "cycles",
    label: "Zyklenlimit",
    value: "max. 2 Vollzyklen/Tag, Deckel 730/Jahr",
  },
  { key: "fcr", label: "FCR", value: "Leistungsanteil 0,8; Gebote am 75. Perzentil" },
  {
    key: "pv_site",
    label: "PV-Standort",
    value: "48,223° N / 10,935° E, 35° Süd, kein Tracker, 10 % Systemverluste",
  },
  {
    key: "no_trader_fee",
    label: "Vermarkterabzug",
    value: "kein Vermarkterabzug; Asset-Backed Trades nicht modelliert",
  },
  { key: "linear_scale", label: "Skalierung", value: "linear ohne Re-Optimierung" },
];

interface AnnahmenPopoverProps {
  assumptions: BacktestingAssumptionItem[];
}

export function AnnahmenPopover({ assumptions }: AnnahmenPopoverProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const items = assumptions.length > 0 ? assumptions : DEFAULT_ASSUMPTIONS;

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div ref={rootRef} style={{ position: "relative", display: "inline-block" }}>
      <button type="button" className="link-btn" onClick={() => setOpen((v) => !v)}>
        Annahmen ({items.length})
      </button>
      {open && (
        <div
          className="card"
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: "0.35rem",
            minWidth: "20rem",
            maxWidth: "26rem",
            zIndex: 20,
            padding: "0.85rem 1rem",
          }}
        >
          <h4 style={{ margin: "0 0 0.65rem", fontSize: "0.9rem" }}>Modellannahmen</h4>
          <ul
            style={{
              margin: 0,
              padding: 0,
              listStyle: "none",
              display: "flex",
              flexDirection: "column",
              gap: "0.55rem",
            }}
          >
            {items.map((item) => (
              <li
                key={item.key}
                style={{
                  paddingBottom: "0.55rem",
                  borderBottom: "1px solid var(--color-border)",
                }}
              >
                <div style={{ fontWeight: 600, fontSize: "0.82rem", marginBottom: "0.15rem" }}>
                  {item.label}
                </div>
                <div className="muted" style={{ fontSize: "0.82rem", lineHeight: 1.45 }}>
                  {item.value}
                </div>
              </li>
            ))}
          </ul>
          {assumptions.length === 0 && (
            <p className="muted" style={{ margin: "0.65rem 0 0", fontSize: "0.78rem" }}>
              Standardannahmen des Backtesting-Modells (§11).
            </p>
          )}
        </div>
      )}
    </div>
  );
}
