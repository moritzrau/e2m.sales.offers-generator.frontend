import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, ApiError } from "../../api/client";
import type {
  FloorAnalyzeResponse,
  FloorAnalyzeResult,
  FloorDefaults,
  PricingResultSummary,
} from "../../api/types";
import { formatDateTime, formatEUR } from "../offers/format";
import { FloorAnalysisView } from "./FloorAnalysisView";
import { FloorForm, type FloorFormState } from "./FloorForm";

type Mode = "per_mw" | "total";

function initialForm(defs: FloorDefaults): FloorFormState {
  const auroraFirst = defs.scaling.aurora.scenarios[0]?.value ?? "central";
  return {
    kombi: "bess_50",
    scaling_name: "aurora",
    scenario: auroraFirst,
    teilungsverhaeltnis: String(defs.defaults.teilungsverhaeltnis),
    degradation: String(defs.defaults.degradation),
    start_year: String(defs.defaults.start_year),
    horizon_years: String(defs.defaults.horizon_years),
    pv_mw: String(defs.defaults.pv_mw),
    discount_rate: String(defs.defaults.discount_rate),
    floor_override: "",
  };
}

export function PricingModule() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FloorFormState | null>(null);
  const [result, setResult] = useState<FloorAnalyzeResult | null>(null);
  const [displayMode, setDisplayMode] = useState<Mode>("per_mw");
  const [error, setError] = useState<string | null>(null);

  const defaults = useQuery<FloorDefaults>({
    queryKey: ["pricing-defaults"],
    queryFn: () => api.get<FloorDefaults>("/api/pricing/floor/defaults"),
  });

  const history = useQuery<PricingResultSummary[]>({
    queryKey: ["pricing-results"],
    queryFn: () => api.get<PricingResultSummary[]>("/api/pricing/results"),
  });

  const currentForm = useMemo(() => {
    if (form) return form;
    if (defaults.data) return initialForm(defaults.data);
    return null;
  }, [form, defaults.data]);

  const analyze = useMutation<FloorAnalyzeResponse, ApiError, void>({
    mutationFn: async () => {
      if (!currentForm) throw new ApiError(500, "Formular noch nicht initialisiert.");
      setError(null);
      const parseNum = (v: string): number | null => {
        if (v === "") return null;
        const n = parseFloat(v.replace(",", "."));
        return Number.isFinite(n) ? n : null;
      };
      const payload = {
        kombi: currentForm.kombi,
        scaling_name: currentForm.scaling_name,
        scenario: currentForm.scenario,
        teilungsverhaeltnis: parseNum(currentForm.teilungsverhaeltnis) ?? 0.84,
        degradation: parseNum(currentForm.degradation) ?? 0.005,
        start_year: parseInt(currentForm.start_year, 10),
        horizon_years: parseInt(currentForm.horizon_years, 10),
        pv_mw: parseNum(currentForm.pv_mw) ?? 5.0,
        discount_rate: parseNum(currentForm.discount_rate),
        npv_base_year: null,
        floor_override:
          currentForm.floor_override === "" ? null : parseInt(currentForm.floor_override, 10),
        save: true,
      };
      return api.post<FloorAnalyzeResponse>("/api/pricing/floor/analyze", payload);
    },
    onSuccess: (data) => {
      setResult(data.result);
      queryClient.invalidateQueries({ queryKey: ["pricing-results"] });
    },
    onError: (err) => setError(err.message),
  });

  if (defaults.isLoading || !currentForm) {
    return <p className="muted">Lade Defaults …</p>;
  }
  if (defaults.isError) {
    return <div className="error-banner">Pricing-Defaults nicht ladbar.</div>;
  }

  const multiplier = displayMode === "total" ? result?.inputs.bess_mw ?? 1 : 1;

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Pricing — Floor-Analyse</h2>
          <p>
            Empfohlener Floor-Preis für Green-Colocation, Basis
            Backtesting-Mehrerlös + Marktprognose (Aurora oder Enervis).
          </p>
        </div>
        {result && (
          <div style={{ display: "flex", gap: "0.4rem" }}>
            <button
              className={`link-btn ${displayMode === "per_mw" ? "active" : ""}`}
              onClick={() => setDisplayMode("per_mw")}
              style={displayMode === "per_mw" ? { color: "var(--color-accent)" } : undefined}
            >
              pro MW BESS
            </button>
            <button
              className={`link-btn ${displayMode === "total" ? "active" : ""}`}
              onClick={() => setDisplayMode("total")}
              style={displayMode === "total" ? { color: "var(--color-accent)" } : undefined}
            >
              Gesamt Anlage
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <h3>Parameter</h3>
        <FloorForm
          defaults={defaults.data!}
          state={currentForm}
          onChange={setForm}
        />
        {error && <div className="error-banner">{error}</div>}
        <button
          className="primary-btn primary-btn--inline"
          onClick={() => analyze.mutate()}
          disabled={analyze.isPending}
          style={{ marginTop: "0.75rem" }}
        >
          {analyze.isPending ? "Rechne …" : "Floor berechnen"}
        </button>
      </div>

      {result && (
        <FloorAnalysisView result={result} multiplier={multiplier} mode={displayMode} />
      )}

      <div className="card" style={{ marginTop: "1rem" }}>
        <h3>Historie</h3>
        {history.isLoading ? (
          <p className="muted">Lade …</p>
        ) : history.data && history.data.length > 0 ? (
          <table className="offers-table">
            <thead>
              <tr>
                <th>Erstellt</th>
                <th>Kombi</th>
                <th>Prognose</th>
                <th>Empf. Floor (€/MW)</th>
              </tr>
            </thead>
            <tbody>
              {history.data.map((row) => (
                <tr key={row.id}>
                  <td>{formatDateTime(row.created_at)}</td>
                  <td>{row.kombi ?? "—"}</td>
                  <td>{row.scaling_name ?? "—"}</td>
                  <td>
                    {row.recommended_floor_eur_per_mw !== null
                      ? formatEUR(row.recommended_floor_eur_per_mw)
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            Noch keine Analysen gespeichert.
          </p>
        )}
      </div>
    </div>
  );
}
