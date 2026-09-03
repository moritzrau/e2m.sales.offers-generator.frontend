import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import { api, ApiError } from "../../api/client";
import type {
  BacktestingAnalyzeResult,
  BacktestingCatalogCombo,
  BacktestingCatalogUseCase,
  BacktestingGreenRevenueResponse,
} from "../../api/types";
import { ResultTabs, type ResultCatalogParams } from "./ResultTabs";
import {
  SourcePicker,
  type BacktestingSourceMode,
  type CustomAnalyzePayload,
} from "./SourcePicker";

const MODE_DESCRIPTION: Record<BacktestingSourceMode, string> = {
  standard:
    "Standard-Katalog live analysieren (SunSync-Backtestings + Compute-Pipeline).",
  custom_config: "Freie Anlagenkonfiguration — Backend skaliert linear auf die nächste Referenzdatei.",
  custom_upload:
    "Eigenes Backtesting hochladen und visualisieren — CSV oder XLSX aus SunSync/PFM.",
};

const USE_CASE_ORDER = ["colocation_green", "colocation_grey", "standalone_bess"] as const;

function StandardCatalogForm({
  onResult,
}: {
  onResult: (result: BacktestingAnalyzeResult, params: ResultCatalogParams) => void;
}) {
  const catalog = useQuery<BacktestingCatalogUseCase[]>({
    queryKey: ["backtesting-catalog"],
    queryFn: () => api.get<BacktestingCatalogUseCase[]>("/api/backtesting/catalog"),
    retry: false,
  });

  const [useCase, setUseCase] = useState<string>("colocation_green");
  const [comboKey, setComboKey] = useState<string>("bess_50");
  const [durationH, setDurationH] = useState<number>(2);
  const [pvMw, setPvMw] = useState<string>("10");
  const [bessMw, setBessMw] = useState<string>("");
  const [includeEeg, setIncludeEeg] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const useCases = catalog.data ?? [];
  const currentUC = useMemo(
    () => useCases.find((u) => u.use_case === useCase) ?? useCases[0],
    [useCases, useCase],
  );
  const currentCombo: BacktestingCatalogCombo | undefined = useMemo(
    () => currentUC?.combos.find((c) => c.combo_key === comboKey) ?? currentUC?.combos[0],
    [currentUC, comboKey],
  );

  const isStandalone = currentUC?.use_case === "standalone_bess";

  const analyze = useMutation<BacktestingAnalyzeResult, ApiError, void>({
    mutationFn: async () => {
      setError(null);
      const parse = (v: string): number | null => {
        if (v === "") return null;
        const n = parseFloat(v.replace(",", "."));
        return Number.isFinite(n) ? n : null;
      };
      const payload: Record<string, unknown> = {
        use_case: currentUC?.use_case,
        combo_key: currentCombo?.combo_key ?? comboKey,
        duration_h: durationH,
        include_eeg: includeEeg,
      };
      if (isStandalone) {
        const b = parse(bessMw);
        if (b !== null) payload.bess_mw = b;
      } else {
        const p = parse(pvMw);
        if (p !== null) payload.pv_mw = p;
      }
      return api.post<BacktestingAnalyzeResult>("/api/backtesting/analyze", payload);
    },
    onSuccess: (data) => {
      const cc = currentCombo?.combo_key ?? comboKey;
      onResult(data, {
        use_case: currentUC?.use_case ?? useCase,
        combo_key: cc,
        duration_h: durationH,
        pv_mw: isStandalone ? null : data.scaled_sizes.pv_mw,
        bess_mw: data.scaled_sizes.bess_mw,
        include_eeg: includeEeg,
      });
    },
    onError: (err) => setError(err.message),
  });

  if (catalog.isLoading) {
    return <p className="muted">Lade Katalog …</p>;
  }
  if (catalog.isError) {
    const status = (catalog.error as ApiError | undefined)?.status;
    if (status === 503) {
      return (
        <div className="error-banner">
          Backtesting-Katalog nicht konfiguriert (BACKTESTING_DATA_DIR fehlt auf dem Server).
        </div>
      );
    }
    return <div className="error-banner">Katalog nicht ladbar.</div>;
  }

  return (
    <div className="card">
      <h3>Neue Analyse</h3>
      <div className="profile-form">
        <label>
          Use Case
          <select
            value={currentUC?.use_case ?? useCase}
            onChange={(e) => {
              const next = e.target.value;
              setUseCase(next);
              const uc = useCases.find((u) => u.use_case === next);
              if (uc && uc.combos.length > 0) {
                setComboKey(uc.combos[0].combo_key);
                setDurationH(uc.combos[0].available_durations_h[0] ?? 2);
              }
            }}
          >
            {USE_CASE_ORDER.filter((uc) => useCases.some((u) => u.use_case === uc)).map((uc) => (
              <option key={uc} value={uc}>
                {useCases.find((u) => u.use_case === uc)?.label ?? uc}
              </option>
            ))}
          </select>
        </label>
        <label>
          Anlagenkombination
          <select
            value={currentCombo?.combo_key ?? comboKey}
            onChange={(e) => {
              setComboKey(e.target.value);
              const c = currentUC?.combos.find((c) => c.combo_key === e.target.value);
              if (c && !c.available_durations_h.includes(durationH)) {
                setDurationH(c.available_durations_h[0] ?? durationH);
              }
            }}
          >
            {currentUC?.combos.map((c) => (
              <option key={c.combo_key} value={c.combo_key}>
                {c.combo_label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Speicherdauer
          <select value={durationH} onChange={(e) => setDurationH(parseInt(e.target.value, 10))}>
            {(currentCombo?.available_durations_h ?? [2, 3, 4]).map((h) => (
              <option key={h} value={h}>
                {h} h
              </option>
            ))}
          </select>
        </label>
        {isStandalone ? (
          <label>
            BESS-Leistung (MW)
            <input
              type="text"
              inputMode="decimal"
              value={bessMw}
              onChange={(e) => setBessMw(e.target.value)}
              placeholder={String(currentCombo?.ref_bess_mw ?? "5")}
            />
          </label>
        ) : (
          <label>
            PV-Leistung (MW)
            <input
              type="text"
              inputMode="decimal"
              value={pvMw}
              onChange={(e) => setPvMw(e.target.value)}
              placeholder={String(currentCombo?.ref_pv_mw ?? "10")}
            />
          </label>
        )}
        {currentUC?.use_case === "colocation_green" && (
          <label
            className="profile-form-hint"
            style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
          >
            <input
              type="checkbox"
              checked={includeEeg}
              onChange={(e) => setIncludeEeg(e.target.checked)}
            />
            EEG-Marktprämie einbeziehen
          </label>
        )}
        {error && <div className="error-banner profile-form-hint">{error}</div>}
        <button
          className="primary-btn"
          onClick={() => analyze.mutate()}
          disabled={analyze.isPending}
        >
          {analyze.isPending ? "Rechne …" : "Analysieren"}
        </button>
      </div>
    </div>
  );
}

export function BacktestingPage() {
  const [mode, setMode] = useState<BacktestingSourceMode>("standard");
  const [result, setResult] = useState<BacktestingAnalyzeResult | null>(null);
  const [catalogParams, setCatalogParams] = useState<ResultCatalogParams | undefined>(undefined);
  const [selectedUploadId, setSelectedUploadId] = useState<number | null>(null);
  const [customError, setCustomError] = useState<string | null>(null);

  const handleModeChange = (next: BacktestingSourceMode) => {
    setMode(next);
    setResult(null);
    setCatalogParams(undefined);
    setCustomError(null);
  };

  const customAnalyze = useMutation<BacktestingAnalyzeResult, ApiError, CustomAnalyzePayload>({
    mutationFn: (payload) =>
      api.post<BacktestingAnalyzeResult>("/api/backtesting/analyze-custom", payload),
    onSuccess: (data, payload) => {
      setCustomError(null);
      setResult(data);
      setCatalogParams({
        use_case: payload.use_case,
        combo_key: data.preset_key,
        duration_h: payload.duration_h,
        pv_mw: payload.pv_mw,
        bess_mw: payload.bess_mw,
        include_eeg: payload.include_eeg,
      });
    },
    onError: (err) => setCustomError(err.message),
  });

  const uploadAnalyze = useMutation<BacktestingAnalyzeResult, ApiError, number>({
    mutationFn: (uploadId) =>
      api.post<BacktestingAnalyzeResult>(`/api/backtesting/uploads/${uploadId}/analyze`),
    onSuccess: (data) => {
      setCustomError(null);
      setResult(data);
      setCatalogParams(undefined);
    },
    onError: (err) => setCustomError(err.message),
  });

  const greenRevenueQuery = useQuery<BacktestingGreenRevenueResponse>({
    queryKey: ["backtesting-green-revenue", catalogParams, result?.use_case],
    queryFn: () => {
      const p = catalogParams!;
      const qs = new URLSearchParams();
      qs.set("use_case", p.use_case);
      qs.set("combo_key", p.combo_key);
      qs.set("duration_h", String(p.duration_h));
      if (p.pv_mw != null) qs.set("pv_mw", String(p.pv_mw));
      if (p.bess_mw != null) qs.set("bess_mw", String(p.bess_mw));
      if (p.include_eeg !== undefined) qs.set("include_eeg", String(p.include_eeg));
      return api.get<BacktestingGreenRevenueResponse>(`/api/backtesting/green-revenue?${qs}`);
    },
    enabled: result?.use_case === "colocation_green" && !!catalogParams?.combo_key,
    retry: false,
  });

  const handleUploadSelect = (id: number | null) => {
    setSelectedUploadId(id);
    setCustomError(null);
    if (id !== null) {
      setResult(null);
      uploadAnalyze.mutate(id);
    }
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Backtesting</h2>
          <p>{MODE_DESCRIPTION[mode]}</p>
        </div>
      </div>

      <SourcePicker
        mode={mode}
        onChange={handleModeChange}
        onCustomAnalyze={(payload) => customAnalyze.mutate(payload)}
        selectedUploadId={selectedUploadId}
        onUploadSelect={handleUploadSelect}
      />

      {mode === "standard" && (
        <div style={{ marginTop: "0.75rem" }}>
          <StandardCatalogForm
            onResult={(data, params) => {
              setResult(data);
              setCatalogParams(params);
            }}
          />
        </div>
      )}

      {customError && <div className="error-banner" style={{ marginTop: "0.75rem" }}>{customError}</div>}
      {mode === "custom_upload" && uploadAnalyze.isPending && (
        <p className="muted" style={{ marginTop: "0.75rem" }}>Analysiere Upload …</p>
      )}

      {result && (
        <ResultTabs
          result={result}
          catalogParams={catalogParams}
          greenRevenue={greenRevenueQuery.data ?? null}
        />
      )}
    </div>
  );
}
