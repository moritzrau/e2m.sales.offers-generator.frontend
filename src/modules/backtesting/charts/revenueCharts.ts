import type {
  BacktestingAnalyzeResult,
  BacktestingMonthlyRecord,
  ChartPayload,
  ChartSeries,
} from "../../../api/types";

export const REVENUE_COLORS = {
  dark_blue: "#001A70",
  medium_blue: "#1057C8",
  light_blue: "#1089FF",
  medium_orange: "#FF861D",
  medium_green: "#88D910",
  dark_orange: "#FE5716",
} as const;

const COMPACT_EUR = new Intl.NumberFormat("de-DE", { notation: "compact" });
const TOOLTIP_EUR = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });

function isNonZeroSeries(data: number[]): boolean {
  return data.some((v) => Math.abs(v) > 1e-6);
}

function filterNonZeroSeries(series: ChartSeries[]): ChartSeries[] {
  return series.filter((s) => isNonZeroSeries(s.data));
}

function baseGridOption(months: string[]) {
  return {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      valueFormatter: (v: number) => `${TOOLTIP_EUR.format(v)} €`,
    },
    legend: { bottom: 0 },
    grid: { left: 70, right: 20, top: 20, bottom: 60 },
    xAxis: { type: "category", data: months },
    yAxis: {
      type: "value",
      axisLabel: {
        formatter: (v: number) => COMPACT_EUR.format(v),
      },
    },
  };
}

export function buildRevenueChartOption(payload: ChartPayload): Record<string, unknown> {
  const barSeries = filterNonZeroSeries(payload.series.filter((s) => s.kind === "bar"));
  const lineSeries = filterNonZeroSeries(payload.series.filter((s) => s.kind === "line"));

  return {
    ...baseGridOption(payload.months),
    series: [
      ...barSeries.map((s) => ({
        name: s.name,
        type: "bar",
        stack: "erloes",
        data: s.data.map((v) => Math.round(v)),
        itemStyle: { color: s.color ?? REVENUE_COLORS.medium_blue },
      })),
      ...lineSeries.map((s) => ({
        name: s.name,
        type: "line",
        data: s.data.map((v) => Math.round(v)),
        itemStyle: { color: s.color ?? REVENUE_COLORS.dark_blue },
        lineStyle: { width: 2 },
        symbol: "circle",
        symbolSize: 6,
        z: 10,
      })),
    ],
  };
}

export function buildRevenueChartPayloadFromMonthly(
  result: BacktestingAnalyzeResult,
): ChartPayload {
  const months = result.monthly.map((m) => m.month_label);
  let series: ChartSeries[];

  if (result.use_case === "standalone_bess") {
    series = [
      {
        name: "FCR",
        data: result.monthly.map((m) => m.fcr_eur),
        color: REVENUE_COLORS.dark_blue,
        kind: "bar",
      },
      {
        name: "aFRR positiv",
        data: result.monthly.map((m) => m.afrr_pos_eur),
        color: REVENUE_COLORS.medium_blue,
        kind: "bar",
      },
      {
        name: "aFRR negativ",
        data: result.monthly.map((m) => m.afrr_neg_eur),
        color: REVENUE_COLORS.light_blue,
        kind: "bar",
      },
      {
        name: "Wholesale",
        data: result.monthly.map((m) => m.wholesale_eur),
        color: REVENUE_COLORS.medium_orange,
        kind: "bar",
      },
    ];
  } else if (result.use_case === "colocation_green") {
    series = [
      {
        name: "Grundvergütung",
        data: result.monthly.map((m) => m.grundverguetung),
        color: REVENUE_COLORS.medium_blue,
        kind: "bar",
      },
      {
        name: "Mehrerlöse",
        data: result.monthly.map((m) => m.mehrerloese_brutto),
        color: REVENUE_COLORS.medium_orange,
        kind: "bar",
      },
    ];
    if (result.monthly.some((m) => m.eeg_revenue_eur > 0)) {
      series.push({
        name: "EEG-Marktprämie",
        data: result.monthly.map((m) => m.eeg_revenue_eur),
        color: REVENUE_COLORS.medium_green,
        kind: "bar",
      });
    }
  } else {
    series = [
      {
        name: "PV-Erlös (DA)",
        data: result.monthly.map((m) => m.pv_revenue_eur),
        color: REVENUE_COLORS.medium_green,
        kind: "bar",
      },
      {
        name: "FCR",
        data: result.monthly.map((m) => m.fcr_eur),
        color: REVENUE_COLORS.dark_blue,
        kind: "bar",
      },
      {
        name: "aFRR positiv",
        data: result.monthly.map((m) => m.afrr_pos_eur),
        color: REVENUE_COLORS.medium_blue,
        kind: "bar",
      },
      {
        name: "aFRR negativ",
        data: result.monthly.map((m) => m.afrr_neg_eur),
        color: REVENUE_COLORS.light_blue,
        kind: "bar",
      },
      {
        name: "Wholesale",
        data: result.monthly.map((m) => m.wholesale_eur),
        color: REVENUE_COLORS.medium_orange,
        kind: "bar",
      },
    ];
  }

  series.push({
    name: "Gesamt",
    data: result.monthly.map((m) => m.total_revenue_eur),
    color: REVENUE_COLORS.dark_blue,
    kind: "line",
  });

  return { months, series: filterNonZeroSeries(series) };
}

export function buildRevenueShareDonutOption(
  slices: { name: string; value: number; color: string }[],
): Record<string, unknown> {
  const nonZero = slices.filter((s) => Math.abs(s.value) > 1e-6);
  return {
    tooltip: {
      trigger: "item",
      valueFormatter: (v: number) => `${TOOLTIP_EUR.format(v)} €`,
    },
    legend: { bottom: 0 },
    series: [
      {
        type: "pie",
        radius: ["42%", "68%"],
        center: ["50%", "45%"],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 4, borderColor: "#fff", borderWidth: 2 },
        label: {
          formatter: "{b}\n{d}%",
        },
        data: nonZero.map((s) => ({
          name: s.name,
          value: Math.round(s.value),
          itemStyle: { color: s.color },
        })),
      },
    ],
  };
}

export function buildArbitrageSpreadOption(monthly: BacktestingMonthlyRecord[]): Record<string, unknown> {
  const months = monthly.map((m) => m.month_label);
  return {
    tooltip: {
      trigger: "axis",
      valueFormatter: (v: number) => `${TOOLTIP_EUR.format(v)} €/MWh`,
    },
    legend: { bottom: 0 },
    grid: { left: 70, right: 20, top: 20, bottom: 60 },
    xAxis: { type: "category", data: months },
    yAxis: {
      type: "value",
      name: "€/MWh",
      axisLabel: {
        formatter: (v: number) => COMPACT_EUR.format(v),
      },
    },
    series: [
      {
        name: "Ø Ladepreis",
        type: "line",
        data: monthly.map((m) => m.avg_charge_price ?? 0),
        itemStyle: { color: REVENUE_COLORS.medium_blue },
        symbol: "circle",
        symbolSize: 6,
      },
      {
        name: "Ø Entladepreis",
        type: "line",
        data: monthly.map((m) => m.avg_discharge_price ?? 0),
        itemStyle: { color: REVENUE_COLORS.dark_orange },
        symbol: "circle",
        symbolSize: 6,
      },
    ],
  };
}

export interface GreenRevenueMonthly {
  month: string;
  month_label?: string;
  revenue_pv_only_eur: number;
  colocation_revenue_ex_eeg_eur: number;
  mehrwert_colocation_eur: number;
}

export function buildGreenComparisonOption(
  monthly: GreenRevenueMonthly[],
): Record<string, unknown> {
  const months = monthly.map((m) => m.month_label ?? m.month);
  return {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      valueFormatter: (v: number) => `${TOOLTIP_EUR.format(v)} €`,
    },
    legend: { bottom: 0 },
    grid: { left: 70, right: 20, top: 20, bottom: 60 },
    xAxis: { type: "category", data: months },
    yAxis: {
      type: "value",
      axisLabel: {
        formatter: (v: number) => COMPACT_EUR.format(v),
      },
    },
    series: [
      {
        name: "PV-only",
        type: "bar",
        data: monthly.map((m) => Math.round(m.revenue_pv_only_eur)),
        itemStyle: { color: REVENUE_COLORS.medium_green },
      },
      {
        name: "CoLocation (ohne EEG)",
        type: "bar",
        data: monthly.map((m) => Math.round(m.colocation_revenue_ex_eeg_eur)),
        itemStyle: { color: REVENUE_COLORS.medium_blue },
      },
      {
        name: "Mehrwert CoLocation",
        type: "line",
        data: monthly.map((m) => Math.round(m.mehrwert_colocation_eur)),
        itemStyle: { color: REVENUE_COLORS.dark_orange },
        lineStyle: { width: 2 },
        symbol: "circle",
        symbolSize: 6,
        z: 10,
      },
    ],
  };
}

export function buildCumulativeRevenueOption(monthly: BacktestingMonthlyRecord[]): Record<string, unknown> {
  const months = monthly.map((m) => m.month_label);
  let cumulative = 0;
  const values = monthly.map((m) => {
    cumulative += m.total_revenue_eur;
    return Math.round(cumulative);
  });

  return {
    tooltip: {
      trigger: "axis",
      valueFormatter: (v: number) => `${TOOLTIP_EUR.format(v)} €`,
    },
    grid: { left: 70, right: 20, top: 20, bottom: 40 },
    xAxis: { type: "category", data: months },
    yAxis: {
      type: "value",
      axisLabel: {
        formatter: (v: number) => COMPACT_EUR.format(v),
      },
    },
    series: [
      {
        name: "Kumulierter Erlös",
        type: "line",
        smooth: true,
        data: values,
        itemStyle: { color: REVENUE_COLORS.dark_blue },
        areaStyle: { color: "rgba(0, 26, 112, 0.08)" },
        symbol: "circle",
        symbolSize: 6,
      },
    ],
  };
}

export function sumMonthlyField(
  monthly: BacktestingMonthlyRecord[],
  field: keyof BacktestingMonthlyRecord,
): number {
  return monthly.reduce((acc, row) => acc + (Number(row[field]) || 0), 0);
}
