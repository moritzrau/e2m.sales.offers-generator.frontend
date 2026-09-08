import type { BacktestingAssumptionItem } from "../../../api/types";

const DEFAULT_ASSUMPTIONS: BacktestingAssumptionItem[] = [
  { key: "rte", label: "Round-Trip-Effizienz", value: "0,95–0,97" },
  {
    key: "dod",
    label: "Depth of Discharge (DoD)",
    value: "0,90–0,95 → nutzbare Kapazität < Nennkapazität",
  },
  { key: "cycles", label: "Zyklenlimit", value: "max. 2 Vollzyklen/Tag, Deckel 730/Jahr" },
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

/**
 * Annahmen als aufklappbare Fusszeile unter dem Ergebnis statt als Popover
 * oben rechts — dort gehoeren sie fachlich hin: erst die Zahl, dann die
 * Bedingungen, unter denen sie gilt.
 */
export function AnnahmenFooter({ assumptions }: { assumptions: BacktestingAssumptionItem[] }) {
  const items = assumptions.length > 0 ? assumptions : DEFAULT_ASSUMPTIONS;
  return (
    <details className="bt-assumptions">
      <summary>Annahmen der Berechnung ({items.length})</summary>
      <dl>
        {items.map((item) => (
          <div key={item.key}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
