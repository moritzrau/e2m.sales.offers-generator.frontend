import { COLORS, FONT_FAMILY, categoryAxis, legend, textStyle, tooltip } from "./theme";

export const DAY_COLORS = {
  dark_blue: "#001A70",
  medium_blue: "#1057C8",
  light_blue: "#1089FF",
  medium_orange: "#FF861D",
  medium_green: "#88D910",
  dark_orange: "#FE5716",
} as const;

const COMPACT_NUM = new Intl.NumberFormat("de-DE", { notation: "compact" });
const TOOLTIP_EUR = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });
const TOOLTIP_MW = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 });
const TIME_LABEL = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" });

export interface DetailDayRow {
  timestamp: string;
  soc_mwh: number;
  price_eur_mwh: number;
  fcr_neg_mw: number;
  fcr_pos_mw: number;
  fcr_eur: number;
  afrr_pos_eur: number;
  afrr_neg_eur: number;
  wholesale_eur: number;
  total_revenue_eur: number;
  pv_curtailment_mwh: number;
  pv_gross_mwh: number;
  pv_mw: number;
  charge_mw: number;
  discharge_mw: number;
}

export interface DetailDayResponse {
  preset_key: string;
  date: string;
  rows: DetailDayRow[];
}

export interface DayProfileResponse {
  preset_key: string;
  month: string | null;
  hours: string[];
  price: number[];
  soc: number[];
  pv_mw: number[];
  charge_mw: number[];
  discharge_mw: number[];
  revenue_eur: number[];
}

function formatTimeLabel(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : TIME_LABEL.format(d);
}

function hasNonZero(values: number[]): boolean {
  return values.some((v) => Math.abs(v) > 1e-6);
}

function baseDayGrid(labels: string[], bottom = 40) {
  return {
    textStyle,
    animationDuration: 420,
    tooltip: tooltip({
      trigger: "axis",
      axisPointer: { type: "line", lineStyle: { color: COLORS.line, width: 1 } },
    }),
    legend: legend(),
    grid: { left: 8, right: 8, top: 26, bottom, containLabel: true },
    xAxis: categoryAxis(labels, { axisLabel: { interval: 11, color: COLORS.muted, fontSize: 11, fontFamily: FONT_FAMILY } }),
  };
}

export function buildDayScheduleOption(
  rows: DetailDayRow[],
  options: { showPv: boolean },
): Record<string, unknown> {
  const labels = rows.map((r) => formatTimeLabel(r.timestamp));
  const series: Record<string, unknown>[] = [];

  if (options.showPv && hasNonZero(rows.map((r) => r.pv_mw))) {
    series.push({
      name: "PV",
      type: "line",
      data: rows.map((r) => r.pv_mw),
      itemStyle: { color: DAY_COLORS.medium_green },
      lineStyle: { width: 1.6, color: "#4F9E30" },
      areaStyle: { color: "rgba(136, 217, 16, 0.20)" },
      yAxisIndex: 0,
      showSymbol: false,
    });
  }

  if (hasNonZero(rows.map((r) => r.charge_mw))) {
    series.push({
      name: "Laden",
      type: "bar",
      data: rows.map((r) => r.charge_mw),
      itemStyle: { color: DAY_COLORS.medium_blue },
      yAxisIndex: 0,
    });
  }

  if (hasNonZero(rows.map((r) => r.discharge_mw))) {
    series.push({
      name: "Entladen",
      type: "bar",
      data: rows.map((r) => r.discharge_mw),
      itemStyle: { color: DAY_COLORS.dark_orange },
      yAxisIndex: 0,
    });
  }

  series.push({
    name: "SoC",
    type: "line",
    data: rows.map((r) => r.soc_mwh),
    itemStyle: { color: DAY_COLORS.dark_blue },
    lineStyle: { width: 2 },
    yAxisIndex: 1,
    showSymbol: false,
  });

  return {
    ...baseDayGrid(labels),
    tooltip: tooltip({
      trigger: "axis",
      axisPointer: { type: "line", lineStyle: { color: COLORS.line, width: 1 } },
      valueFormatter: (v: number, _idx: number, params: { seriesName?: string }) => {
        if (params.seriesName === "SoC") return `${TOOLTIP_MW.format(v)} MWh`;
        return `${TOOLTIP_MW.format(v)} MW`;
      },
    }),
    yAxis: [
      {
        type: "value",
        name: "MW",
        position: "left",
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: COLORS.grid } },
        nameTextStyle: { color: COLORS.muted, fontSize: 11, fontFamily: FONT_FAMILY },
        axisLabel: {
          color: COLORS.muted,
          fontSize: 11,
          fontFamily: FONT_FAMILY,
          formatter: (v: number) => COMPACT_NUM.format(v),
        },
      },
      {
        type: "value",
        name: "MWh",
        position: "right",
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        nameTextStyle: { color: COLORS.muted, fontSize: 11, fontFamily: FONT_FAMILY },
        axisLabel: {
          color: COLORS.muted,
          fontSize: 11,
          fontFamily: FONT_FAMILY,
          formatter: (v: number) => COMPACT_NUM.format(v),
        },
      },
    ],
    series,
  };
}

/** Zusammenhaengende Bereiche mit negativem Preis als [von, bis]-Labelpaare. */
function negativePriceBands(rows: DetailDayRow[], labels: string[]): [string, string][] {
  const bands: [string, string][] = [];
  let start: number | null = null;
  rows.forEach((r, i) => {
    if (r.price_eur_mwh < 0) {
      if (start === null) start = i;
    } else if (start !== null) {
      bands.push([labels[start], labels[i - 1]]);
      start = null;
    }
  });
  if (start !== null) bands.push([labels[start], labels[rows.length - 1]]);
  return bands;
}

export function buildDayPriceRevenueOption(rows: DetailDayRow[]): Record<string, unknown> {
  const labels = rows.map((r) => formatTimeLabel(r.timestamp));
  const negativeBands = negativePriceBands(rows, labels);
  const hasNegativePrice = negativeBands.length > 0;
  let cumulative = 0;
  const cumRevenue = rows.map((r) => {
    cumulative += r.total_revenue_eur;
    return Math.round(cumulative * 100) / 100;
  });

  return {
    ...baseDayGrid(labels),
    tooltip: tooltip({
      trigger: "axis",
      axisPointer: { type: "line", lineStyle: { color: COLORS.line, width: 1 } },
      valueFormatter: (v: number, _idx: number, params: { seriesName?: string }) => {
        if (params.seriesName === "Preis") return `${TOOLTIP_MW.format(v)} €/MWh`;
        return `${TOOLTIP_EUR.format(v)} €`;
      },
    }),
    yAxis: [
      {
        type: "value",
        name: "€/MWh",
        position: "left",
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: COLORS.grid } },
        nameTextStyle: { color: COLORS.muted, fontSize: 11, fontFamily: FONT_FAMILY },
        axisLabel: {
          color: COLORS.muted,
          fontSize: 11,
          fontFamily: FONT_FAMILY,
          formatter: (v: number) => COMPACT_NUM.format(v),
        },
      },
      {
        type: "value",
        name: "€",
        position: "right",
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        nameTextStyle: { color: COLORS.muted, fontSize: 11, fontFamily: FONT_FAMILY },
        axisLabel: {
          color: COLORS.muted,
          fontSize: 11,
          fontFamily: FONT_FAMILY,
          formatter: (v: number) => COMPACT_NUM.format(v),
        },
      },
    ],
    series: [
      {
        name: "Preis",
        type: "line",
        data: rows.map((r) => r.price_eur_mwh),
        itemStyle: { color: DAY_COLORS.medium_orange },
        lineStyle: { width: 2 },
        yAxisIndex: 0,
        showSymbol: false,
        // Stunden mit negativem Preis rot hinterlegen — dort verdient der
        // Speicher am Laden statt am Verkaufen.
        markArea: hasNegativePrice
          ? {
              silent: true,
              itemStyle: { color: "rgba(254, 87, 22, 0.10)" },
              data: negativeBands.map((b) => [{ xAxis: b[0] }, { xAxis: b[1] }]),
            }
          : undefined,
        markLine: hasNegativePrice
          ? {
              silent: true,
              symbol: "none",
              lineStyle: { color: DAY_COLORS.dark_orange, type: "dashed", width: 1.2 },
              label: { show: false },
              data: [{ yAxis: 0 }],
            }
          : undefined,
      },
      {
        name: "Kum. Tageserlös",
        type: "line",
        data: cumRevenue,
        itemStyle: { color: DAY_COLORS.dark_blue },
        areaStyle: { color: "rgba(0, 26, 112, 0.08)" },
        yAxisIndex: 1,
        showSymbol: false,
      },
    ],
  };
}

export function buildDayFcrOption(rows: DetailDayRow[]): Record<string, unknown> {
  const labels = rows.map((r) => formatTimeLabel(r.timestamp));
  const series: Record<string, unknown>[] = [];

  if (hasNonZero(rows.map((r) => r.fcr_pos_mw))) {
    series.push({
      name: "FCR positiv",
      type: "bar",
      data: rows.map((r) => r.fcr_pos_mw),
      itemStyle: { color: DAY_COLORS.medium_blue },
    });
  }

  if (hasNonZero(rows.map((r) => r.fcr_neg_mw))) {
    series.push({
      name: "FCR negativ",
      type: "bar",
      data: rows.map((r) => r.fcr_neg_mw),
      itemStyle: { color: DAY_COLORS.light_blue },
    });
  }

  return {
    ...baseDayGrid(labels),
    tooltip: {
      trigger: "axis",
      valueFormatter: (v: number) => `${TOOLTIP_MW.format(v)} MW`,
    },
    yAxis: {
      type: "value",
      name: "MW",
      axisLabel: { formatter: (v: number) => COMPACT_NUM.format(v) },
    },
    series,
  };
}

export function buildDayProfileOption(
  profile: DayProfileResponse,
  options: { showPv: boolean },
): Record<string, unknown> {
  const { hours } = profile;
  const series: Record<string, unknown>[] = [];

  if (options.showPv && hasNonZero(profile.pv_mw)) {
    series.push({
      name: "Ø PV",
      type: "line",
      data: profile.pv_mw,
      itemStyle: { color: DAY_COLORS.medium_green },
      yAxisIndex: 0,
      showSymbol: false,
    });
  }

  if (hasNonZero(profile.charge_mw)) {
    series.push({
      name: "Ø Laden",
      type: "bar",
      data: profile.charge_mw,
      itemStyle: { color: DAY_COLORS.medium_blue },
      yAxisIndex: 0,
    });
  }

  if (hasNonZero(profile.discharge_mw)) {
    series.push({
      name: "Ø Entladen",
      type: "bar",
      data: profile.discharge_mw,
      itemStyle: { color: DAY_COLORS.dark_orange },
      yAxisIndex: 0,
    });
  }

  if (hasNonZero(profile.price)) {
    series.push({
      name: "Ø Preis",
      type: "line",
      data: profile.price,
      itemStyle: { color: DAY_COLORS.medium_orange },
      yAxisIndex: 1,
      lineStyle: { width: 2 },
      showSymbol: false,
    });
  }

  return {
    ...baseDayGrid(hours),
    tooltip: {
      trigger: "axis",
      valueFormatter: (v: number, _idx: number, params: { seriesName?: string }) => {
        if (params.seriesName === "Ø Preis") return `${TOOLTIP_MW.format(v)} €/MWh`;
        return `${TOOLTIP_MW.format(v)} MW`;
      },
    },
    yAxis: [
      {
        type: "value",
        name: "MW",
        position: "left",
        axisLabel: { formatter: (v: number) => COMPACT_NUM.format(v) },
      },
      {
        type: "value",
        name: "€/MWh",
        position: "right",
        axisLabel: { formatter: (v: number) => COMPACT_NUM.format(v) },
      },
    ],
    series,
  };
}
