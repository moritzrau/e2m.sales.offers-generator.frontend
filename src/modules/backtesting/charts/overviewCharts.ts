import type { BacktestingAnalyzeResult, BacktestingMonthlyRecord } from "../../../api/types";
import { COLORS, FONT_FAMILY, compactEur, eur, legend, monthlyBase, textStyle, tooltip } from "./theme";

/* ------------------------------------------------------------------ */
/* Wasserfall — „woher kommt der Erloes"                                */
/* ------------------------------------------------------------------ */

export interface WaterfallStep {
  name: string;
  value: number;
  color: string;
}

export interface WaterfallSpec {
  steps: WaterfallStep[];
  totalLabel: string;
  total: number;
  /** Schritt, dessen Anteil am Sockel als Prozentmarke angezeigt wird. */
  highlightIndex?: number;
}

/**
 * Baut den Erloes-Wasserfall aus einem Analyseergebnis.
 * Gibt null zurueck, wenn weniger als zwei Bestandteile ungleich null sind —
 * dann sagt ein Wasserfall nichts, was die Kachel nicht schon zeigt.
 */
export function buildWaterfallSpec(result: BacktestingAnalyzeResult): WaterfallSpec | null {
  const m = result.monthly;
  const sum = (f: (r: BacktestingMonthlyRecord) => number) =>
    m.reduce((acc, r) => acc + (f(r) || 0), 0);

  let steps: WaterfallStep[];
  let highlightIndex: number | undefined;

  if (result.use_case === "colocation_green") {
    steps = [
      { name: "PV-only", value: sum((r) => r.grundverguetung), color: COLORS.blue },
      { name: "+ Speicher", value: sum((r) => r.mehrerloese_brutto), color: COLORS.orange },
      { name: "+ EEG-Marktprämie", value: sum((r) => r.eeg_revenue_eur), color: COLORS.green },
    ];
    highlightIndex = 1;
  } else if (result.use_case === "colocation_grey") {
    steps = [
      { name: "PV-Erlös", value: sum((r) => r.pv_revenue_eur), color: COLORS.green },
      { name: "+ FCR", value: sum((r) => r.fcr_eur), color: COLORS.blueDark },
      {
        name: "+ aFRR",
        value: sum((r) => r.afrr_pos_eur) + sum((r) => r.afrr_neg_eur),
        color: COLORS.blue,
      },
      { name: "+ Wholesale", value: sum((r) => r.wholesale_eur), color: COLORS.orange },
    ];
    highlightIndex = 3;
  } else {
    steps = [
      { name: "FCR", value: sum((r) => r.fcr_eur), color: COLORS.blueDark },
      {
        name: "+ aFRR",
        value: sum((r) => r.afrr_pos_eur) + sum((r) => r.afrr_neg_eur),
        color: COLORS.blue,
      },
      { name: "+ Wholesale", value: sum((r) => r.wholesale_eur), color: COLORS.orange },
    ];
  }

  const active = steps.filter((s) => Math.abs(s.value) > 1);
  if (active.length < 2) return null;

  return {
    steps: active,
    totalLabel: "Gesamterlös",
    total: active.reduce((a, s) => a + s.value, 0),
    highlightIndex:
      highlightIndex !== undefined && active.length === steps.length ? highlightIndex : undefined,
  };
}

export function buildWaterfallOption(spec: WaterfallSpec): Record<string, unknown> {
  const names = [...spec.steps.map((s) => s.name), spec.totalLabel];

  // Unsichtbarer Sockel, auf dem die sichtbaren Balken aufsetzen.
  const base: number[] = [];
  const bars: number[] = [];
  let running = 0;
  spec.steps.forEach((s, i) => {
    base.push(i === 0 ? 0 : running);
    bars.push(s.value);
    running += s.value;
  });
  base.push(0);
  bars.push(spec.total);

  const colors = [...spec.steps.map((s) => s.color), COLORS.blueDark];

  return {
    textStyle,
    animationDuration: 480,
    tooltip: tooltip({
      trigger: "axis",
      axisPointer: { type: "shadow", shadowStyle: { color: "rgba(0,26,112,.05)" } },
      formatter: (params: Array<{ dataIndex: number }>) => {
        const i = params[0]?.dataIndex ?? 0;
        return `${names[i]}<br/><b>${eur(bars[i])}</b>`;
      },
    }),
    grid: { left: 8, right: 16, top: 46, bottom: 26, containLabel: true },
    xAxis: {
      type: "category",
      data: names,
      axisLine: { lineStyle: { color: COLORS.line } },
      axisTick: { show: false },
      axisLabel: {
        color: COLORS.ink2,
        fontSize: 11.5,
        fontWeight: 500,
        fontFamily: FONT_FAMILY,
        interval: 0,
      },
    },
    yAxis: {
      type: "value",
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: COLORS.grid } },
      axisLabel: {
        color: COLORS.muted,
        fontSize: 11,
        fontFamily: FONT_FAMILY,
        formatter: compactEur,
      },
    },
    series: [
      {
        name: "sockel",
        type: "bar",
        stack: "wf",
        silent: true,
        itemStyle: { color: "transparent" },
        emphasis: { itemStyle: { color: "transparent" } },
        data: base,
      },
      {
        name: "Erlös",
        type: "bar",
        stack: "wf",
        barMaxWidth: 96,
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: (p: { dataIndex: number }) => colors[p.dataIndex],
        },
        label: {
          show: true,
          position: "top",
          distance: 8,
          color: COLORS.ink,
          fontSize: 12.5,
          fontWeight: 700,
          fontFamily: FONT_FAMILY,
          formatter: (p: { dataIndex: number }) => eur(bars[p.dataIndex]),
        },
        data: bars,
      },
    ],
  };
}

/** Prozentmarke für den hervorgehobenen Schritt („+74 % gegenüber PV-only"). */
export function waterfallHighlight(spec: WaterfallSpec): string | null {
  if (spec.highlightIndex === undefined || spec.highlightIndex < 1) return null;
  const step = spec.steps[spec.highlightIndex];
  const bases = spec.steps.slice(0, spec.highlightIndex).reduce((a, s) => a + s.value, 0);
  if (!step || bases <= 0 || step.value <= 0) return null;
  const pct = (step.value / bases) * 100;
  const base = spec.steps[0]?.name ?? "Basis";
  return `${step.name.replace(/^\+\s*/, "")} hebt den Erlös um ${new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 0,
  }).format(pct)} % gegenüber ${base}.`;
}

/* ------------------------------------------------------------------ */
/* Arbitrage-Spread als Flaeche                                         */
/* ------------------------------------------------------------------ */

export function buildSpreadAreaOption(
  monthly: BacktestingMonthlyRecord[],
): Record<string, unknown> | null {
  const rows = monthly.filter(
    (m) => (m.avg_discharge_price ?? 0) !== 0 || (m.avg_charge_price ?? 0) !== 0,
  );
  if (rows.length === 0) return null;

  const months = rows.map((m) => m.month_label);
  const charge = rows.map((m) => Math.round(m.avg_charge_price ?? 0));
  const discharge = rows.map((m) => Math.round(m.avg_discharge_price ?? 0));
  const spread = discharge.map((d, i) => d - charge[i]);

  return {
    ...monthlyBase(months, "eurPerMwh", { axisName: "€/MWh" }),
    tooltip: tooltip({
      trigger: "axis",
      axisPointer: { type: "line", lineStyle: { color: COLORS.line } },
      formatter: (params: Array<{ dataIndex: number }>) => {
        const i = params[0]?.dataIndex ?? 0;
        return [
          `<b>${months[i]}</b>`,
          `Ø Entladepreis &nbsp;<b>${discharge[i]} €/MWh</b>`,
          `Ø Ladepreis &nbsp;<b>${charge[i]} €/MWh</b>`,
          `<span style="color:${COLORS.orangeDark}">Spread &nbsp;<b>${spread[i]} €/MWh</b></span>`,
        ].join("<br/>");
      },
    }),
    legend: legend({ data: ["Ø Entladepreis", "Ø Ladepreis"] }),
    series: [
      // Untere Kante des Bandes (unsichtbar), darauf die Differenzflaeche.
      {
        name: "band-basis",
        type: "line",
        stack: "band",
        silent: true,
        symbol: "none",
        lineStyle: { opacity: 0 },
        areaStyle: { opacity: 0 },
        data: charge,
        tooltip: { show: false },
        z: 1,
      },
      {
        name: "Spread",
        type: "line",
        stack: "band",
        silent: true,
        symbol: "none",
        lineStyle: { opacity: 0 },
        areaStyle: { color: COLORS.blue, opacity: 0.14 },
        data: spread,
        tooltip: { show: false },
        z: 1,
      },
      {
        name: "Ø Entladepreis",
        type: "line",
        data: discharge,
        symbol: "circle",
        symbolSize: 7,
        lineStyle: { width: 2.4, color: COLORS.orangeDark },
        itemStyle: { color: COLORS.orangeDark },
        z: 5,
      },
      {
        name: "Ø Ladepreis",
        type: "line",
        data: charge,
        symbol: "circle",
        symbolSize: 7,
        lineStyle: { width: 2.4, color: COLORS.blue },
        itemStyle: { color: COLORS.blue },
        z: 5,
      },
    ],
  };
}
