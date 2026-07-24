import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import { api, ApiError } from "../../api/client";
import type { Backtest, CockpitConfig, OfferSummary } from "../../api/types";

const USE_CASE_LABEL: Record<string, string> = {
  colocation_green: "Co-Location Grün",
  colocation_grey: "Co-Location Grau",
  standalone_bess: "Standalone BESS",
};

interface Props {
  onCancel: () => void;
  onCreated: (offerId: number) => void;
}

type Variant = "backtest" | "use_case";

export function OneClickPage({ onCancel, onCreated }: Props) {
  const [variant, setVariant] = useState<Variant>("backtest");
  const [backtestId, setBacktestId] = useState<number | null>(null);
  const [useCase, setUseCase] = useState<string>("colocation_green");
  const [pvMw, setPvMw] = useState<string>("");
  const [bessMw, setBessMw] = useState<string>("");
  const [bessMwh, setBessMwh] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const backtests = useQuery<Backtest[]>({
    queryKey: ["backtests"],
    queryFn: () => api.get<Backtest[]>("/api/backtests"),
  });

  const cockpitCfg = useQuery<CockpitConfig>({
    queryKey: ["cockpit-config", useCase],
    queryFn: () =>
      api.get<CockpitConfig>(
        `/api/pricing/config?use_case=${encodeURIComponent(useCase)}`,
      ),
    enabled: variant === "use_case",
    retry: false,
  });
  const stdBacktesting = cockpitCfg.data?.standard_backtesting ?? null;

  const parseNum = (v: string): number | null => {
    if (v === "") return null;
    const n = parseFloat(v.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };

  const create = useMutation<OfferSummary, ApiError, void>({
    mutationFn: async () => {
      setError(null);
      const payload: Record<string, unknown> = {};
      if (variant === "backtest") {
        if (backtestId === null) {
          throw new ApiError(400, "Bitte ein Backtesting wählen.");
        }
        payload.backtest_id = backtestId;
      } else {
        payload.use_case = useCase;
      }
      const pv = parseNum(pvMw);
      const bm = parseNum(bessMw);
      const bmh = parseNum(bessMwh);
      if (pv !== null) payload.pv_mw = pv;
      if (bm !== null) payload.bess_mw = bm;
      if (bmh !== null) payload.bess_mwh = bmh;
      return api.post<OfferSummary>("/api/offers/oneclick", payload);
    },
    onSuccess: (offer) => onCreated(offer.id),
    onError: (err) => setError(err.message),
  });

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Neues Angebot · One-Click</h2>
          <p>
            Ohne Wizard: Backtesting oder Use Case wählen — der Cockpit-Solver
            berechnet TV und Konstanten mit den Defaults aus{" "}
            <code>cockpit_config.yaml</code>, das Angebot wird sofort angelegt.
          </p>
        </div>
        <button className="link-btn" onClick={onCancel}>
          Abbrechen
        </button>
      </div>

      <div className="wizard-stepper" style={{ marginBottom: "1rem" }}>
        <button
          type="button"
          className={`wizard-stepper__item ${variant === "backtest" ? "active" : ""}`}
          onClick={() => setVariant("backtest")}
        >
          Auf existierendem Backtesting
        </button>
        <button
          type="button"
          className={`wizard-stepper__item ${variant === "use_case" ? "active" : ""}`}
          onClick={() => setVariant("use_case")}
        >
          Aus Standard-Backtesting je Use Case
        </button>
      </div>

      <div className="card">
        {variant === "backtest" ? (
          <>
            <h3>Backtesting wählen</h3>
            {backtests.isLoading && <p className="muted">Lade …</p>}
            {backtests.data && backtests.data.length === 0 && (
              <p className="muted">
                Noch keine Backtestings. Lade zuerst eines unter „Interaktiv erstellen" hoch.
              </p>
            )}
            <div className="lead-list">
              {backtests.data?.map((bt) => (
                <label key={bt.id} className="lead-list__row">
                  <input
                    type="radio"
                    checked={backtestId === bt.id}
                    onChange={() => setBacktestId(bt.id)}
                  />
                  <span>
                    <strong>{bt.original_filename ?? `Backtest #${bt.id}`}</strong>
                    <span className="muted" style={{ marginLeft: "0.4rem" }}>
                      {bt.backtest_type ?? "unbekannter Typ"}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </>
        ) : (
          <>
            <h3>Use Case wählen</h3>
            <p className="muted" style={{ marginTop: 0 }}>
              Das Standard-Backtesting je Use Case wird in{" "}
              <code>cockpit_config.yaml</code> gepflegt. Ist keins hinterlegt,
              muss oben ein Backtesting aus der Liste gewählt werden.
            </p>
            <div className="profile-form">
              <label>
                Use Case
                <select
                  value={useCase}
                  onChange={(e) => setUseCase(e.target.value)}
                  style={{
                    width: "100%",
                    marginTop: "0.3rem",
                    padding: "0.5rem 0.7rem",
                    border: "1px solid var(--color-border)",
                    borderRadius: 9,
                  }}
                >
                  {Object.entries(USE_CASE_LABEL).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {cockpitCfg.data && stdBacktesting === null && (
              <div className="error-banner" style={{ marginTop: "0.75rem" }}>
                Für „{USE_CASE_LABEL[useCase]}" ist noch kein Standard-Backtesting
                hinterlegt. Bitte oben auf „Auf existierendem Backtesting"
                wechseln oder <code>standard_backtesting</code> in{" "}
                <code>cockpit_config.yaml</code> ergänzen.
              </div>
            )}
            {stdBacktesting && (
              <p className="muted" style={{ marginTop: "0.5rem" }}>
                Standard: {stdBacktesting.combo_key} · {stdBacktesting.duration_h} h
                {stdBacktesting.pv_mw !== null &&
                  stdBacktesting.pv_mw !== undefined &&
                  ` · ${stdBacktesting.pv_mw} MW PV`}
                {stdBacktesting.bess_mw !== null &&
                  stdBacktesting.bess_mw !== undefined &&
                  ` · ${stdBacktesting.bess_mw} MW BESS`}
              </p>
            )}
          </>
        )}

        <details style={{ marginTop: "1rem" }}>
          <summary>Anlagengrößen setzen (optional)</summary>
          <div className="profile-form" style={{ marginTop: "0.75rem" }}>
            <label>
              PV (MW)
              <input
                type="text"
                inputMode="decimal"
                value={pvMw}
                onChange={(e) => setPvMw(e.target.value)}
              />
            </label>
            <label>
              BESS (MW)
              <input
                type="text"
                inputMode="decimal"
                value={bessMw}
                onChange={(e) => setBessMw(e.target.value)}
              />
            </label>
            <label>
              BESS (MWh)
              <input
                type="text"
                inputMode="decimal"
                value={bessMwh}
                onChange={(e) => setBessMwh(e.target.value)}
              />
            </label>
          </div>
        </details>

        {error && <div className="error-banner" style={{ marginTop: "1rem" }}>{error}</div>}

        <div style={{ marginTop: "1rem" }}>
          <button
            className="primary-btn primary-btn--inline"
            onClick={() => create.mutate()}
            disabled={
              create.isPending ||
              (variant === "backtest" && backtestId === null) ||
              (variant === "use_case" && stdBacktesting === null)
            }
          >
            {create.isPending ? "Erstelle Angebot …" : "Angebot erstellen"}
          </button>
        </div>
      </div>
    </div>
  );
}
