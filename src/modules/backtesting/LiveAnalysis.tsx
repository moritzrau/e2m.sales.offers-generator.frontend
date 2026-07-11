import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import ReactECharts from "echarts-for-react";

import { api, ApiError } from "../../api/client";
import type {
  BacktestingAnalyzeResult,
  BacktestingCatalogCombo,
  BacktestingCatalogUseCase,
} from "../../api/types";
import { formatEUR, formatNumber } from "../offers/format";

const USE_CASE_ORDER = ["colocation_green", "colocation_grey", "standalone_bess"] as const;

const COLORS = {
  dark_blue: "#001A70",
  medium_blue: "#1057C8",
  light_blue: "#1089FF",
  medium_orange: "#FF861D",
  medium_green: "#88D910",
  dark_orange: "#FE5716",
};

export function LiveAnalysis() {
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
  const [result, setResult] = useState<BacktestingAnalyzeResult | null>(null);
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
    onSuccess: (data) => setResult(data),
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
    <div>
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
            <select
              value={durationH}
              onChange={(e) => setDurationH(parseInt(e.target.value, 10))}
            >
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

      {result && <ResultView result={result} />}
    </div>
  );
}

function ResultView({ result }: { result: BacktestingAnalyzeResult }) {
  const months = result.monthly.map((m) => m.month_label);

  const seriesFor = (): { name: string; data: number[]; color: string }[] => {
    if (result.use_case === "standalone_bess") {
      return [
        { name: "FCR", data: result.monthly.map((m) => m.fcr_eur), color: COLORS.dark_blue },
        { name: "aFRR positiv", data: result.monthly.map((m) => m.afrr_pos_eur), color: COLORS.medium_blue },
        { name: "aFRR negativ", data: result.monthly.map((m) => m.afrr_neg_eur), color: COLORS.light_blue },
        { name: "Wholesale", data: result.monthly.map((m) => m.wholesale_eur), color: COLORS.medium_orange },
      ];
    }
    if (result.use_case === "colocation_green") {
      const s = [
        { name: "Grundvergütung", data: result.monthly.map((m) => m.grundverguetung), color: COLORS.medium_blue },
        { name: "Mehrerlöse", data: result.monthly.map((m) => m.mehrerloese_brutto), color: COLORS.medium_orange },
      ];
      if (result.monthly.some((m) => m.eeg_revenue_eur > 0)) {
        s.push({ name: "EEG-Marktprämie", data: result.monthly.map((m) => m.eeg_revenue_eur), color: COLORS.medium_green });
      }
      return s;
    }
    return [
      { name: "PV-Erlös (DA)", data: result.monthly.map((m) => m.pv_revenue_eur), color: COLORS.medium_green },
      { name: "FCR", data: result.monthly.map((m) => m.fcr_eur), color: COLORS.dark_blue },
      { name: "aFRR positiv", data: result.monthly.map((m) => m.afrr_pos_eur), color: COLORS.medium_blue },
      { name: "aFRR negativ", data: result.monthly.map((m) => m.afrr_neg_eur), color: COLORS.light_blue },
      { name: "Wholesale", data: result.monthly.map((m) => m.wholesale_eur), color: COLORS.medium_orange },
    ];
  };
  const nonZero = seriesFor().filter((s) => s.data.some((v) => Math.abs(v) > 1e-6));

  const option = {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      valueFormatter: (v: number) =>
        `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(v)} €`,
    },
    legend: { bottom: 0 },
    grid: { left: 70, right: 20, top: 20, bottom: 60 },
    xAxis: { type: "category", data: months },
    yAxis: {
      type: "value",
      axisLabel: {
        formatter: (v: number) =>
          new Intl.NumberFormat("de-DE", { notation: "compact" }).format(v),
      },
    },
    series: nonZero.map((s) => ({
      name: s.name,
      type: "bar",
      stack: "erloes",
      data: s.data.map((v) => Math.round(v)),
      itemStyle: { color: s.color },
    })),
  };

  const s = result.scaled_sizes;

  return (
    <div className="card" style={{ marginTop: "1rem" }}>
      <h3>Ergebnis</h3>
      <p className="muted" style={{ marginTop: 0 }}>
        {result.combo_label} · {result.duration_h}h ·{" "}
        {s.pv_mw !== null && s.pv_mw > 0 ? `${formatNumber(s.pv_mw, 2)} MW PV · ` : ""}
        {formatNumber(s.bess_mw, 2)} MW / {formatNumber(s.bess_mwh, 2)} MWh BESS · Skalierung ×
        {new Intl.NumberFormat("de-DE", { maximumFractionDigits: 3 }).format(s.scale_factor)}
      </p>
      <div className="kpi-grid">
        <div className="kpi-tile">
          <span className="muted">Gesamterlös</span>
          <strong>{formatEUR(result.kpis.total_revenue_eur)}</strong>
        </div>
        {result.kpis.pv_revenue_eur !== null && (
          <div className="kpi-tile">
            <span className="muted">PV-Erlös</span>
            <strong>{formatEUR(result.kpis.pv_revenue_eur)}</strong>
          </div>
        )}
        {result.kpis.eeg_revenue_eur !== null && (
          <div className="kpi-tile">
            <span className="muted">EEG-Marktprämie</span>
            <strong>{formatEUR(result.kpis.eeg_revenue_eur)}</strong>
          </div>
        )}
        <div className="kpi-tile">
          <span className="muted">FCR</span>
          <strong>{formatEUR(result.kpis.fcr_eur)}</strong>
        </div>
        <div className="kpi-tile">
          <span className="muted">aFRR (netto)</span>
          <strong>{formatEUR(result.kpis.afrr_eur)}</strong>
        </div>
        <div className="kpi-tile">
          <span className="muted">Wholesale</span>
          <strong>{formatEUR(result.kpis.wholesale_eur)}</strong>
        </div>
      </div>

      <h4 style={{ marginTop: "1.25rem" }}>Monatliche Erlöse</h4>
      <ReactECharts option={option} style={{ height: 360 }} notMerge lazyUpdate />
    </div>
  );
}
