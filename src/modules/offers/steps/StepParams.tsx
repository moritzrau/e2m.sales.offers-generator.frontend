import type { OfferParams, PrecheckOut } from "../../../api/types";

interface Props {
  precheck: PrecheckOut | undefined;
  params: OfferParams;
  onChange: (params: OfferParams) => void;
}

function toNum(value: string): number | null {
  if (value === "") return null;
  const parsed = parseFloat(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function fmt(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(".", ",");
}

/**
 * Kompakte Zusatzparameter für den Baukasten-Schritt (Phase R-D).
 *
 * ``anteil_mehrerloes_e2m`` und ``dienstleistungsentgelt_eur_per_mwh`` sind
 * ab R-D **nicht mehr hier** — sie kommen aus dem Pricing-Cockpit
 * (siehe ``StepCockpit``) und werden im Backend über die Pricing-Bridge
 * in die OfferParams gemappt. Was übrig bleibt sind Vertragsmodell und
 * optionale MW-Overrides.
 */
export function StepParams({ precheck, params, onChange }: Props) {
  const isGrey = precheck?.use_case === "colocation_grey";
  const isBess = precheck?.use_case === "standalone_bess";

  return (
    <details className="wizard-step">
      <summary>Erweiterte Parameter (Vertragsmodell, MW-Overrides)</summary>
      <div className="profile-form" style={{ marginTop: "0.75rem" }}>
        {!isBess && (
          <label>
            Vertragsmodell
            <select
              value={params.vertragsmodell ?? "DA"}
              onChange={(e) =>
                onChange({ ...params, vertragsmodell: (e.target.value as "DA" | "MMW") })
              }
              style={{
                width: "100%",
                marginTop: "0.3rem",
                padding: "0.5rem 0.7rem",
                border: "1px solid var(--color-border)",
                borderRadius: 9,
              }}
            >
              <option value="DA">Day-Ahead (DA)</option>
              <option value="MMW">Monatsmarktwert (MMW)</option>
            </select>
          </label>
        )}
        <label>
          BESS-Leistung (MW) — optional, überschreibt Lead
          <input
            type="text"
            inputMode="decimal"
            value={fmt(params.batt_power_mw)}
            onChange={(e) => onChange({ ...params, batt_power_mw: toNum(e.target.value) })}
          />
        </label>
        {isGrey && (
          <label>
            PV-Leistung (MW) — nur Grau
            <input
              type="text"
              inputMode="decimal"
              value={fmt(params.pv_power_mw)}
              onChange={(e) => onChange({ ...params, pv_power_mw: toNum(e.target.value) })}
            />
          </label>
        )}
      </div>
    </details>
  );
}
