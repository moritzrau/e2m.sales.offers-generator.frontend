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

export function StepParams({ precheck, params, onChange }: Props) {
  const isGrey = precheck?.use_case === "colocation_grey";
  const isBess = precheck?.use_case === "standalone_bess";

  return (
    <div className="wizard-step">
      <h3>3. Parameter</h3>
      <p className="muted">
        Vorbelegt aus Parameter.xlsx — anpassen, wenn nötig. Achtung: Ein geleertes Feld
        bedeutet „ohne diesen Parameter rechnen" (z. B. Anteil leer = Erlöse ohne
        Teilungsverhältnis).
      </p>

      <div className="profile-form">
        <label>
          Vermarktungsentgelt (€/MWh)
          <input
            type="text"
            inputMode="decimal"
            placeholder={fmt(precheck?.default_params?.dienstleistungsentgelt_eur_per_mwh)}
            value={fmt(params.dienstleistungsentgelt_eur_per_mwh)}
            onChange={(e) =>
              onChange({ ...params, dienstleistungsentgelt_eur_per_mwh: toNum(e.target.value) })
            }
          />
        </label>
        <label>
          Anteil Mehrerlöse e2m (0..1)
          <input
            type="text"
            inputMode="decimal"
            placeholder={fmt(precheck?.default_params?.anteil_mehrerloes_e2m)}
            value={fmt(params.anteil_mehrerloes_e2m)}
            onChange={(e) => onChange({ ...params, anteil_mehrerloes_e2m: toNum(e.target.value) })}
          />
          {params.anteil_mehrerloes_e2m !== null && params.anteil_mehrerloes_e2m !== undefined && (
            <span className="muted" style={{ display: "block", marginTop: "0.2rem" }}>
              Kundenanteil: {Math.round((1 - params.anteil_mehrerloes_e2m) * 1000) / 10} %
              {params.anteil_mehrerloes_e2m > 0.5 && " — ungewöhnlich hoher e2m-Anteil, bitte prüfen"}
            </span>
          )}
        </label>
        {!isBess && (
          <label className="profile-form-hint" style={{ gridColumn: "auto" }}>
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
    </div>
  );
}
