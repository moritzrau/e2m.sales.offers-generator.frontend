import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";

import { api, ApiError } from "../../api/client";
import type { BacktestingAnalyzeResult } from "../../api/types";
import { ResultView } from "./LiveAnalysis";

interface SizesForm {
  pv_mw: string;
  bess_mw: string;
  bess_mwh: string;
  include_eeg: boolean;
}

const EMPTY_SIZES: SizesForm = {
  pv_mw: "",
  bess_mw: "",
  bess_mwh: "",
  include_eeg: true,
};

export function UploadAnalysis() {
  const [file, setFile] = useState<File | null>(null);
  const [sizes, setSizes] = useState<SizesForm>(EMPTY_SIZES);
  const [result, setResult] = useState<BacktestingAnalyzeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const analyze = useMutation<BacktestingAnalyzeResult, ApiError, void>({
    mutationFn: async () => {
      if (!file) throw new ApiError(400, "Bitte zuerst eine CSV-/XLSX-Datei wählen.");
      return api.upload<BacktestingAnalyzeResult>(
        "/api/backtesting/analyze-upload",
        file,
        {
          pv_mw: sizes.pv_mw,
          bess_mw: sizes.bess_mw,
          bess_mwh: sizes.bess_mwh,
          include_eeg: sizes.include_eeg,
        },
      );
    },
    onSuccess: (data) => {
      setResult(data);
      setError(null);
    },
    onError: (err) => {
      setError(err.message);
      setResult(null);
    },
  });

  const reset = () => {
    setFile(null);
    setSizes(EMPTY_SIZES);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div>
      <div className="card">
        <h3>Eigenes Backtesting hochladen</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          CSV oder XLSX aus SunSync / PFM. Der Use Case (Grün / Grau / Standalone) wird
          automatisch aus den Spalten erkannt. Anlagengrößen sind optional — sie werden
          nur für die Anzeige (Zyklen pro Tag) übernommen, es wird nicht skaliert.
        </p>
        <div className="profile-form">
          <label style={{ gridColumn: "1 / -1" }}>
            Datei
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              style={{ display: "block", marginTop: "0.3rem" }}
            />
          </label>
          <label>
            PV (MW) — optional
            <input
              type="text"
              inputMode="decimal"
              value={sizes.pv_mw}
              onChange={(e) => setSizes({ ...sizes, pv_mw: e.target.value })}
            />
          </label>
          <label>
            BESS (MW) — optional
            <input
              type="text"
              inputMode="decimal"
              value={sizes.bess_mw}
              onChange={(e) => setSizes({ ...sizes, bess_mw: e.target.value })}
            />
          </label>
          <label>
            BESS (MWh) — optional
            <input
              type="text"
              inputMode="decimal"
              value={sizes.bess_mwh}
              onChange={(e) => setSizes({ ...sizes, bess_mwh: e.target.value })}
            />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input
              type="checkbox"
              checked={sizes.include_eeg}
              onChange={(e) => setSizes({ ...sizes, include_eeg: e.target.checked })}
            />
            EEG-Marktprämie in Erlöse einbeziehen (nur Grün relevant)
          </label>
        </div>
        {error && <div className="error-banner">{error}</div>}
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
          <button
            className="primary-btn primary-btn--inline"
            onClick={() => analyze.mutate()}
            disabled={!file || analyze.isPending}
          >
            {analyze.isPending ? "Analysiere …" : "Analysieren"}
          </button>
          <button className="link-btn" onClick={reset} disabled={analyze.isPending}>
            Zurücksetzen
          </button>
        </div>
      </div>

      {result && (
        <div style={{ marginTop: "1rem" }}>
          <ResultView result={result} />
        </div>
      )}
    </div>
  );
}
