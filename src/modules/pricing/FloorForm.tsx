import type { FloorDefaults, FloorScenarioOption } from "../../api/types";

export interface FloorFormState {
  kombi: string;
  scaling_name: "aurora" | "enervis";
  scenario: string;
  teilungsverhaeltnis: string;
  degradation: string;
  start_year: string;
  horizon_years: string;
  pv_mw: string;
  discount_rate: string;
  floor_override: string;
}

interface Props {
  defaults: FloorDefaults;
  state: FloorFormState;
  onChange: (next: FloorFormState) => void;
}

export function FloorForm({ defaults, state, onChange }: Props) {
  const set = <K extends keyof FloorFormState>(key: K, value: FloorFormState[K]) => {
    onChange({ ...state, [key]: value });
  };

  const scenarios: FloorScenarioOption[] =
    state.scaling_name === "aurora"
      ? defaults.scaling.aurora.scenarios
      : defaults.scaling.enervis.scenarios;

  return (
    <div className="profile-form">
      <label>
        Anlagenkombination
        <select value={state.kombi} onChange={(e) => set("kombi", e.target.value)}>
          {defaults.kombis.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Prognose
        <select
          value={state.scaling_name}
          onChange={(e) => {
            const next = e.target.value as "aurora" | "enervis";
            const firstScenario =
              next === "aurora"
                ? defaults.scaling.aurora.scenarios[0]?.value
                : defaults.scaling.enervis.scenarios[0]?.value;
            onChange({
              ...state,
              scaling_name: next,
              scenario: firstScenario ?? state.scenario,
            });
          }}
        >
          <option value="aurora">Aurora ({defaults.scaling.aurora.base_year})</option>
          <option value="enervis">Enervis ({defaults.scaling.enervis.base_year})</option>
        </select>
      </label>
      <label>
        Szenario
        <select value={state.scenario} onChange={(e) => set("scenario", e.target.value)}>
          {scenarios.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Teilungsverhältnis (Kundenanteil)
        <input
          type="text"
          inputMode="decimal"
          value={state.teilungsverhaeltnis}
          onChange={(e) => set("teilungsverhaeltnis", e.target.value)}
        />
      </label>
      <label>
        Degradation (p.a.)
        <input
          type="text"
          inputMode="decimal"
          value={state.degradation}
          onChange={(e) => set("degradation", e.target.value)}
        />
      </label>
      <label>
        Start-Jahr
        <input
          type="number"
          min={defaults.ranges.start_year[0]}
          max={defaults.ranges.start_year[1]}
          value={state.start_year}
          onChange={(e) => set("start_year", e.target.value)}
        />
      </label>
      <label>
        Horizont (Jahre)
        <input
          type="number"
          min={defaults.ranges.horizon_years[0]}
          max={defaults.ranges.horizon_years[1]}
          value={state.horizon_years}
          onChange={(e) => set("horizon_years", e.target.value)}
        />
      </label>
      <label>
        PV-Leistung (MW)
        <input
          type="text"
          inputMode="decimal"
          value={state.pv_mw}
          onChange={(e) => set("pv_mw", e.target.value)}
        />
      </label>
      <label>
        Zinssatz (NPV)
        <input
          type="text"
          inputMode="decimal"
          value={state.discount_rate}
          onChange={(e) => set("discount_rate", e.target.value)}
        />
      </label>
      <label>
        Floor-Override (€/MW, optional)
        <input
          type="number"
          step={defaults.ranges.floor_step_eur}
          value={state.floor_override}
          placeholder="leer = empfohlener Floor"
          onChange={(e) => set("floor_override", e.target.value)}
        />
      </label>
    </div>
  );
}
