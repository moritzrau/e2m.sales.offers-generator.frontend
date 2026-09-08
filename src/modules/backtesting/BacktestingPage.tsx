import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";

import { api, ApiError } from "../../api/client";
import type {
  BacktestingAnalyzeResult,
  BacktestingCatalogCombo,
  BacktestingCatalogUseCase,
  BacktestingGreenRevenueResponse,
} from "../../api/types";
import { ResultTabs, type ResultCatalogParams, type TabKey } from "./ResultTabs";
import { ConfigBar, type ConfigChip } from "./components/ConfigBar";
import { ResultSkeleton } from "./components/Skeletons";
import { UploadPanel } from "./SourcePicker";
import { formatNumber } from "../offers/format";

type Mode = "standard" | "frei" | "upload";

const MODE_LABELS: Record<Mode, string> = {
  standard: "Katalog",
  frei: "Freie Konfiguration",
  upload: "Eigenes Backtesting",
};

const MODE_DESCRIPTION: Record<Mode, string> = {
  standard: "Standard-Katalog live analysieren — SunSync-Backtestings durch die Compute-Pipeline.",
  frei: "Anlagengrößen frei eingeben — das Backend wählt die nächste Referenzdatei und skaliert linear.",
  upload: "Eigenes Backtesting hochladen und mit denselben Auswertungen visualisieren.",
};

const USE_CASE_ORDER = ["colocation_green", "colocation_grey", "standalone_bess"] as const;

const UC_SHORT: Record<string, string> = {
  colocation_green: "green",
  colocation_grey: "grey",
  standalone_bess: "standalone",
};
const UC_LONG: Record<string, string> = {
  green: "colocation_green",
  grey: "colocation_grey",
  standalone: "standalone_bess",
};
const UC_LABEL: Record<string, string> = {
  colocation_green: "Co-Location Grün",
  colocation_grey: "Co-Location Grau",
  standalone_bess: "Standalone BESS",
};

const DURATIONS = [1, 2, 3, 4];

function parseDecimal(value: string): number | null {
  if (value.trim() === "") return null;
  const n = parseFloat(value.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function BacktestingPage() {
  const [params, setParams] = useSearchParams();

  /* ---------------- Zustand, aus der URL vorbelegt ---------------- */

  const [mode, setMode] = useState<Mode>(() => {
    const q = params.get("q");
    return q === "frei" || q === "upload" ? q : "standard";
  });
  const [useCase, setUseCase] = useState<string>(
    () => UC_LONG[params.get("uc") ?? ""] ?? "colocation_green",
  );
  const [comboKey, setComboKey] = useState<string>(() => params.get("combo") ?? "bess_50");
  const [durationH, setDurationH] = useState<number>(() => Number(params.get("h")) || 2);
  const [pvMw, setPvMw] = useState<string>(() => params.get("pv") ?? "10");
  const [bessMw, setBessMw] = useState<string>(() => params.get("bess") ?? "");
  const [includeEeg, setIncludeEeg] = useState<boolean>(() => params.get("eeg") !== "0");
  const [selectedUploadId, setSelectedUploadId] = useState<number | null>(() => {
    const raw = Number(params.get("upload"));
    return Number.isFinite(raw) && raw > 0 ? raw : null;
  });
  const [tab, setTab] = useState<TabKey>(() => (params.get("tab") as TabKey) || "uebersicht");

  const [configOpen, setConfigOpen] = useState(true);
  const [result, setResult] = useState<BacktestingAnalyzeResult | null>(null);
  const [catalogParams, setCatalogParams] = useState<ResultCatalogParams | undefined>();
  const [error, setError] = useState<string | null>(null);

  /* ---------------- Katalog ---------------- */

  const catalog = useQuery<BacktestingCatalogUseCase[]>({
    queryKey: ["backtesting-catalog"],
    queryFn: () => api.get<BacktestingCatalogUseCase[]>("/api/backtesting/catalog"),
    retry: false,
  });

  const useCases = catalog.data ?? [];
  const currentUC = useMemo(
    () => useCases.find((u) => u.use_case === useCase) ?? useCases[0],
    [useCases, useCase],
  );
  const currentCombo: BacktestingCatalogCombo | undefined = useMemo(
    () => currentUC?.combos.find((c) => c.combo_key === comboKey) ?? currentUC?.combos[0],
    [currentUC, comboKey],
  );
  const isStandalone = useCase === "standalone_bess";
  const isGreen = useCase === "colocation_green";

  /* ---------------- URL spiegeln ---------------- */

  useEffect(() => {
    const next = new URLSearchParams();
    if (mode !== "standard") next.set("q", mode);
    if (mode === "upload") {
      if (selectedUploadId != null) next.set("upload", String(selectedUploadId));
    } else {
      next.set("uc", UC_SHORT[useCase] ?? "green");
      if (mode === "standard" && comboKey) next.set("combo", comboKey);
      next.set("h", String(durationH));
      if (!isStandalone && pvMw) next.set("pv", pvMw);
      if (isStandalone && bessMw) next.set("bess", bessMw);
      if (mode === "frei" && !isStandalone && bessMw) next.set("bess", bessMw);
      if (isGreen && !includeEeg) next.set("eeg", "0");
    }
    if (tab !== "uebersicht") next.set("tab", tab);
    setParams(next, { replace: true });
  }, [
    mode,
    useCase,
    comboKey,
    durationH,
    pvMw,
    bessMw,
    includeEeg,
    selectedUploadId,
    tab,
    isStandalone,
    isGreen,
    setParams,
  ]);

  /* ---------------- Analyse ---------------- */

  const analyze = useMutation<BacktestingAnalyzeResult, ApiError, void>({
    mutationFn: async () => {
      setError(null);
      if (mode === "frei") {
        const bess = parseDecimal(bessMw);
        if (bess === null || bess <= 0) throw new ApiError(400, "Bitte eine BESS-Leistung in MW angeben.");
        const pv = isStandalone ? null : parseDecimal(pvMw);
        if (!isStandalone && (pv === null || pv <= 0))
          throw new ApiError(400, "Bitte eine PV-Leistung in MW angeben.");
        return api.post<BacktestingAnalyzeResult>("/api/backtesting/analyze-custom", {
          use_case: useCase,
          pv_mw: pv,
          bess_mw: bess,
          duration_h: durationH,
          include_eeg: includeEeg,
        });
      }
      const payload: Record<string, unknown> = {
        use_case: currentUC?.use_case ?? useCase,
        combo_key: currentCombo?.combo_key ?? comboKey,
        duration_h: durationH,
        include_eeg: includeEeg,
      };
      if (isStandalone) {
        const b = parseDecimal(bessMw);
        if (b !== null) payload.bess_mw = b;
      } else {
        const p = parseDecimal(pvMw);
        if (p !== null) payload.pv_mw = p;
      }
      return api.post<BacktestingAnalyzeResult>("/api/backtesting/analyze", payload);
    },
    onSuccess: (data) => {
      setResult(data);
      setCatalogParams({
        use_case: data.use_case,
        // Standard-Katalog: die Folge-Endpunkte erwarten den combo_key
        // ("bess_50"), NICHT den preset_key ("green_bess_50_2h").
        // Bei freier Konfiguration gibt es keinen Katalogeintrag — dort ist
        // der vom Backend gewaehlte preset_key die richtige Referenz.
        combo_key:
          mode === "standard" ? (currentCombo?.combo_key ?? comboKey) : data.preset_key,
        duration_h: durationH,
        pv_mw: isStandalone ? null : data.scaled_sizes.pv_mw,
        bess_mw: data.scaled_sizes.bess_mw,
        include_eeg: includeEeg,
      });
      setConfigOpen(false); // Steuerung schrumpft, Ergebnis waechst.
    },
    onError: (err) => setError(err.message),
  });

  const uploadAnalyze = useMutation<BacktestingAnalyzeResult, ApiError, number>({
    mutationFn: (uploadId) =>
      api.post<BacktestingAnalyzeResult>(`/api/backtesting/uploads/${uploadId}/analyze`),
    onSuccess: (data) => {
      setError(null);
      setResult(data);
      setCatalogParams(undefined);
      setConfigOpen(false);
    },
    onError: (err) => setError(err.message),
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

  const changeMode = (next: Mode) => {
    setMode(next);
    setResult(null);
    setCatalogParams(undefined);
    setError(null);
    setConfigOpen(true);
  };

  const handleUploadSelect = useCallback((id: number | null) => {
    setSelectedUploadId(id);
    setError(null);
    if (id !== null) {
      setResult(null);
      uploadAnalyze.mutate(id);
    }
    // uploadAnalyze ist stabil genug; bewusst nicht in den Deps, um Schleifen zu vermeiden.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- Chips fuer die eingeklappte Leiste ---------------- */

  const chips: ConfigChip[] = useMemo(() => {
    if (mode === "upload") {
      return [
        { label: "Eigenes Backtesting", tone: "key" },
        ...(result ? [{ label: result.label }] : []),
      ];
    }
    const out: ConfigChip[] = [{ label: UC_LABEL[useCase] ?? useCase, tone: "key" }];
    if (mode === "standard" && currentCombo) out.push({ label: currentCombo.combo_label });
    if (mode === "frei") out.push({ label: "frei konfiguriert", tone: "warn" });
    out.push({ label: `${durationH} h` });
    if (!isStandalone && pvMw) out.push({ label: `${formatNumber(parseDecimal(pvMw) ?? 0, 1)} MW PV` });
    if (bessMw) out.push({ label: `${formatNumber(parseDecimal(bessMw) ?? 0, 1)} MW BESS` });
    if (isGreen) out.push({ label: includeEeg ? "EEG ein" : "EEG aus" });
    return out;
  }, [mode, useCase, currentCombo, durationH, pvMw, bessMw, includeEeg, isStandalone, isGreen, result]);

  const busy = analyze.isPending || uploadAnalyze.isPending;

  /* ---------------- Formular je Modus ---------------- */

  const catalogBroken =
    catalog.isError && (catalog.error as ApiError | undefined)?.status === 503;

  const configForm = (
    <>
      {mode === "upload" ? (
        <UploadPanel selectedUploadId={selectedUploadId} onUploadSelect={handleUploadSelect} />
      ) : (
        <>
          <div className="bt-form">
            <label className="bt-field">
              <span>Use Case</span>
              <select
                value={useCase}
                onChange={(e) => {
                  const next = e.target.value;
                  setUseCase(next);
                  const uc = useCases.find((u) => u.use_case === next);
                  if (mode === "standard" && uc && uc.combos.length > 0) {
                    setComboKey(uc.combos[0].combo_key);
                    setDurationH(uc.combos[0].available_durations_h[0] ?? 2);
                  }
                }}
              >
                {USE_CASE_ORDER.map((uc) => (
                  <option key={uc} value={uc}>
                    {UC_LABEL[uc]}
                  </option>
                ))}
              </select>
            </label>

            {mode === "standard" && (
              <label className="bt-field">
                <span>Anlagenkombination</span>
                <select
                  value={currentCombo?.combo_key ?? comboKey}
                  onChange={(e) => {
                    setComboKey(e.target.value);
                    const c = currentUC?.combos.find((x) => x.combo_key === e.target.value);
                    if (c && !c.available_durations_h.includes(durationH)) {
                      setDurationH(c.available_durations_h[0] ?? durationH);
                    }
                  }}
                >
                  {(currentUC?.combos ?? []).map((c) => (
                    <option key={c.combo_key} value={c.combo_key}>
                      {c.combo_label}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="bt-field">
              <span>Speicherdauer</span>
              <select value={durationH} onChange={(e) => setDurationH(Number(e.target.value))}>
                {(mode === "standard"
                  ? (currentCombo?.available_durations_h ?? [2, 3, 4])
                  : DURATIONS
                ).map((h) => (
                  <option key={h} value={h}>
                    {h} h
                  </option>
                ))}
              </select>
            </label>

            {!isStandalone && (
              <label className="bt-field">
                <span>PV-Leistung (MW)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={pvMw}
                  onChange={(e) => setPvMw(e.target.value)}
                  placeholder={String(currentCombo?.ref_pv_mw ?? "10")}
                />
              </label>
            )}

            {(isStandalone || mode === "frei") && (
              <label className="bt-field">
                <span>BESS-Leistung (MW)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={bessMw}
                  onChange={(e) => setBessMw(e.target.value)}
                  placeholder={String(currentCombo?.ref_bess_mw ?? "5")}
                />
              </label>
            )}

            {isGreen && (
              <label className="bt-check">
                <input
                  type="checkbox"
                  checked={includeEeg}
                  onChange={(e) => setIncludeEeg(e.target.checked)}
                />
                EEG-Marktprämie einbeziehen
              </label>
            )}
          </div>

          {mode === "frei" && (
            <p className="bt-hint">
              Näherung: lineare Skalierung ohne Re-Optimierung. Ergebnisse können von einer
              projektspezifischen Neuberechnung abweichen.
            </p>
          )}

          <div className="bt-actions">
            <button
              type="button"
              className="bt-btn bt-btn--primary"
              onClick={() => analyze.mutate()}
              disabled={busy || catalog.isLoading || catalogBroken}
            >
              {busy ? "Rechne …" : "Analysieren"}
            </button>
            {result && (
              <span className="bt-hint" style={{ margin: 0 }}>
                Ergebnis wird ersetzt.
              </span>
            )}
          </div>
        </>
      )}
    </>
  );

  return (
    <div>
      <div className="bt-head">
        <div>
          <h2>Backtesting</h2>
          <p>{MODE_DESCRIPTION[mode]}</p>
        </div>
        <div className="bt-segmented" role="tablist" aria-label="Datenquelle">
          {(Object.keys(MODE_LABELS) as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              className={mode === m ? "is-active" : ""}
              onClick={() => changeMode(m)}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>
      </div>

      {catalogBroken && (
        <div className="error-banner">
          Backtesting-Katalog nicht konfiguriert (BACKTESTING_DATA_DIR fehlt auf dem Server).
        </div>
      )}
      {catalog.isError && !catalogBroken && (
        <div className="error-banner">Katalog nicht ladbar.</div>
      )}

      <ConfigBar
        chips={chips}
        open={configOpen}
        onToggle={() => setConfigOpen((v) => !v)}
      >
        {configForm}
      </ConfigBar>

      {error && <div className="error-banner">{error}</div>}

      {busy && <ResultSkeleton />}

      {!busy && result && (
        <ResultTabs
          result={result}
          catalogParams={catalogParams}
          greenRevenue={greenRevenueQuery.data ?? null}
          tab={tab}
          onTabChange={setTab}
        />
      )}

      {!busy && !result && !catalog.isError && (
        <div className="bt-empty">
          <strong>Noch kein Ergebnis</strong>
          {mode === "upload"
            ? "Wählen Sie oben ein hochgeladenes Backtesting aus."
            : "Konfiguration prüfen und auf „Analysieren“ klicken."}
        </div>
      )}
    </div>
  );
}
