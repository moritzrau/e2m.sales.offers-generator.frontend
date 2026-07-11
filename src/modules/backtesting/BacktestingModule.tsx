import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, ApiError } from "../../api/client";
import type { BacktestRequest, UseCase } from "../../api/types";
import { formatDateTime } from "../offers/format";
import { LiveAnalysis } from "./LiveAnalysis";

const USE_CASE_LABEL: Record<UseCase, string> = {
  colocation_green: "Co-Location Grün",
  colocation_grey: "Co-Location Grau",
  standalone_bess: "Standalone BESS",
};

const STATUS_LABEL: Record<BacktestRequest["status"], string> = {
  pending: "Wartet auf PFM",
  running: "PFM rechnet",
  done: "Fertig",
  error: "Fehler",
};

interface Form {
  use_case: UseCase;
  pv_mw: string;
  bess_mw: string;
  bess_mwh: string;
  grid_limit_mw: string;
  eeg_eur_per_mwh: string;
  notes: string;
}

const EMPTY_FORM: Form = {
  use_case: "colocation_green",
  pv_mw: "",
  bess_mw: "",
  bess_mwh: "",
  grid_limit_mw: "",
  eeg_eur_per_mwh: "",
  notes: "",
};

function toNum(v: string): number | null {
  if (v === "") return null;
  const n = parseFloat(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

type Tab = "live" | "requests";

export function BacktestingModule() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("live");
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);

  const requests = useQuery<BacktestRequest[]>({
    queryKey: ["backtest-requests"],
    queryFn: () => api.get<BacktestRequest[]>("/api/backtests/requests"),
    refetchInterval: (query) => {
      const rows = query.state.data ?? [];
      return rows.some((r) => r.status === "pending" || r.status === "running") ? 5000 : false;
    },
  });

  const submit = useMutation<BacktestRequest, ApiError, void>({
    mutationFn: async () => {
      setError(null);
      setNotConfigured(false);
      const payload: Record<string, unknown> = {
        use_case: form.use_case,
        plant: {
          pv_mw: toNum(form.pv_mw),
          bess_mw: toNum(form.bess_mw),
          bess_mwh: toNum(form.bess_mwh),
          grid_limit_mw: toNum(form.grid_limit_mw),
          eeg_eur_per_mwh: toNum(form.eeg_eur_per_mwh),
        },
      };
      if (form.notes) payload.notes = form.notes;
      return api.post<BacktestRequest>("/api/backtests/requests", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["backtest-requests"] });
      setForm(EMPTY_FORM);
    },
    onError: (err) => {
      if (err.status === 503) {
        setNotConfigured(true);
      } else {
        setError(err.message);
      }
    },
  });

  const scanNow = useMutation<{ job_id: number }, ApiError, void>({
    mutationFn: () => api.post<{ job_id: number }>("/api/connectors/scan"),
    onSuccess: () => {
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["backtest-requests"] }), 2000);
    },
  });

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Backtesting</h2>
          <p>
            {tab === "live"
              ? "Live-Auswertung skalierter SunSync-Backtestings (Katalog + Compute-Pipeline)."
              : "Anlagenparameter an PFM übermitteln — Ergebnis wird nach Berechnung automatisch importiert."}
          </p>
        </div>
        {tab === "requests" && (
          <button
            className="link-btn"
            onClick={() => scanNow.mutate()}
            disabled={scanNow.isPending}
          >
            Watchfolder jetzt scannen
          </button>
        )}
      </div>

      <div className="wizard-stepper" style={{ marginBottom: "1rem" }}>
        <button
          type="button"
          className={`wizard-stepper__item ${tab === "live" ? "active" : ""}`}
          onClick={() => setTab("live")}
        >
          Live-Analyse
        </button>
        <button
          type="button"
          className={`wizard-stepper__item ${tab === "requests" ? "active" : ""}`}
          onClick={() => setTab("requests")}
        >
          Anfragen an PFM
        </button>
      </div>

      {tab === "live" && <LiveAnalysis />}

      {tab === "requests" && notConfigured && (
        <div className="error-banner">
          Der Backtest-Roundtrip ist noch nicht konfiguriert (kein Watchfolder
          gesetzt). PFM/IT haben den H:-Mount noch nicht bereitgestellt.
        </div>
      )}

      {tab === "requests" && (
      <>
      <div className="card">
        <h3>Neue Anfrage</h3>
        <div className="profile-form">
          <label>
            Use Case
            <select
              value={form.use_case}
              onChange={(e) => setForm({ ...form, use_case: e.target.value as UseCase })}
              style={{
                width: "100%",
                marginTop: "0.3rem",
                padding: "0.5rem 0.7rem",
                border: "1px solid var(--color-border)",
                borderRadius: 9,
              }}
            >
              <option value="colocation_green">Co-Location Grün</option>
              <option value="colocation_grey">Co-Location Grau</option>
              <option value="standalone_bess">Standalone BESS</option>
            </select>
          </label>
          <label>
            PV (MW)
            <input
              type="text"
              inputMode="decimal"
              value={form.pv_mw}
              onChange={(e) => setForm({ ...form, pv_mw: e.target.value })}
            />
          </label>
          <label>
            BESS (MW)
            <input
              type="text"
              inputMode="decimal"
              value={form.bess_mw}
              onChange={(e) => setForm({ ...form, bess_mw: e.target.value })}
            />
          </label>
          <label>
            BESS (MWh)
            <input
              type="text"
              inputMode="decimal"
              value={form.bess_mwh}
              onChange={(e) => setForm({ ...form, bess_mwh: e.target.value })}
            />
          </label>
          <label>
            Netz-Grenze (MW)
            <input
              type="text"
              inputMode="decimal"
              value={form.grid_limit_mw}
              onChange={(e) => setForm({ ...form, grid_limit_mw: e.target.value })}
            />
          </label>
          <label>
            EEG-Wert (€/MWh)
            <input
              type="text"
              inputMode="decimal"
              value={form.eeg_eur_per_mwh}
              onChange={(e) => setForm({ ...form, eeg_eur_per_mwh: e.target.value })}
            />
          </label>
          <label className="profile-form-hint">
            Notizen für PFM
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </label>
          {error && <div className="error-banner profile-form-hint">{error}</div>}
          <button
            className="primary-btn"
            onClick={() => submit.mutate()}
            disabled={submit.isPending}
          >
            {submit.isPending ? "Übermittle …" : "Anfrage an PFM senden"}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: "1rem" }}>
        <h3>Anfragen</h3>
        {requests.isLoading ? (
          <p className="muted">Lade …</p>
        ) : requests.data && requests.data.length > 0 ? (
          <table className="offers-table">
            <thead>
              <tr>
                <th>Erstellt</th>
                <th>Use Case</th>
                <th>Status</th>
                <th>Backtesting</th>
              </tr>
            </thead>
            <tbody>
              {requests.data.map((req) => {
                const useCase = (req.payload_json.use_case as UseCase) ?? "colocation_green";
                return (
                  <tr key={req.id}>
                    <td>{formatDateTime(req.submitted_at)}</td>
                    <td>{USE_CASE_LABEL[useCase] ?? useCase}</td>
                    <td>
                      <span className={`badge badge--${req.status}`}>
                        {STATUS_LABEL[req.status]}
                      </span>
                    </td>
                    <td>
                      {req.result_backtest_id
                        ? `→ Backtesting #${req.result_backtest_id}`
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            Noch keine Anfragen.
          </p>
        )}
      </div>

      </>
      )}
    </div>
  );
}
