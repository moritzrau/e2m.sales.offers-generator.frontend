import type { BacktestingMonthlyRecord, ChartPayload, ChartSeries } from "../../../api/types";
import { formatNumber } from "../../offers/format";

export const ENERGY_COLORS = {
  dark_blue: "#001A70",
  medium_blue: "#1057C8",
  light_blue: "#1089FF",
  medium_orange: "#FF861D",
  medium_green: "#88D910",
  dark_orange: "#FE5716",
} as const;

const PV_STACK_NAMES = new Set(["PV direkt", "PV → Batterie", "Abregelung"]);

function sumField(monthly: BacktestingMonthlyRecord[], field: keyof BacktestingMonthlyRecord): number {
  return monthly.reduce((acc, row) => {
    const v = row[field];
    return acc + (typeof v === "number" && Number.isFinite(v) ? v : 0);
  }, 0);
}

function clampNonNegative(v: number): number {
  return Math.max(v, 0);
}

function scalePairToTarget(
  a: number,
  b: number,
  target: number,
): [number, number] {
  const sum = a + b;
  if (sum <= 0 || target <= 0) return [a, b];
  if (Math.abs(sum - target) / target <= 0.001) return [a, b];
  const sc = target / sum;
  return [a * sc, b * sc];
}

function scaleTripleToTarget(
  a: number,
  b: number,
  c: number,
  target: number,
): [number, number, number] {
  const sum = a + b + c;
  if (sum <= 0 || target <= 0) return [a, b, c];
  if (Math.abs(sum - target) / target <= 0.001) return [a, b, c];
  const sc = target / sum;
  return [a * sc, b * sc, c * sc];
}

export interface SankeyFlows {
  pv_gross: number;
  pv_direct: number;
  pv_to_batt: number;
  curtail: number;
  batt_to_grid: number;
  batt_loss: number;
  grid_to_batt: number;
}

export function aggregateSankeyFlows(
  monthly: BacktestingMonthlyRecord[],
  isGrey: boolean,
): SankeyFlows {
  const pv_gross = clampNonNegative(sumField(monthly, "pv_gross_mwh"));
  let pv_direct = clampNonNegative(sumField(monthly, "pv_direct_mwh"));
  let pv_to_batt = clampNonNegative(sumField(monthly, "pv_to_battery_mwh"));
  let curtail = clampNonNegative(sumField(monthly, "pv_curtailment_mwh"));
  let batt_to_grid = clampNonNegative(sumField(monthly, "battery_to_grid_mwh"));
  let batt_loss = clampNonNegative(sumField(monthly, "battery_loss_mwh"));
  let grid_to_batt = clampNonNegative(sumField(monthly, "grid_to_battery_mwh"));

  if (pv_gross > 0) {
    [pv_direct, pv_to_batt, curtail] = scaleTripleToTarget(
      pv_direct,
      pv_to_batt,
      curtail,
      pv_gross,
    );
  }

  if (isGrey) {
    const batt_charge = pv_to_batt + grid_to_batt;
    if (batt_charge > 0) {
      [batt_to_grid, batt_loss] = scalePairToTarget(batt_to_grid, batt_loss, batt_charge);
    }
  } else if (pv_to_batt > 0) {
    [batt_to_grid, batt_loss] = scalePairToTarget(batt_to_grid, batt_loss, pv_to_batt);
  }

  return {
    pv_gross,
    pv_direct,
    pv_to_batt,
    curtail,
    batt_to_grid,
    batt_loss,
    grid_to_batt,
  };
}

export function buildEnergyChartPayloadFromMonthly(
  monthly: BacktestingMonthlyRecord[],
  isGrey: boolean,
): ChartPayload {
  const series: ChartSeries[] = [
    {
      name: "PV direkt",
      data: monthly.map((m) => m.pv_direct_mwh ?? 0),
      color: ENERGY_COLORS.medium_green,
      kind: "bar",
    },
    {
      name: "PV → Batterie",
      data: monthly.map((m) => m.pv_to_battery_mwh ?? 0),
      color: ENERGY_COLORS.medium_blue,
      kind: "bar",
    },
    {
      name: "Abregelung",
      data: monthly.map((m) => m.pv_curtailment_mwh ?? 0),
      color: ENERGY_COLORS.dark_orange,
      kind: "bar",
    },
    {
      name: "Batterie → Netz",
      data: monthly.map((m) => m.battery_to_grid_mwh ?? 0),
      color: ENERGY_COLORS.medium_orange,
      kind: "line",
    },
    {
      name: "PV-Einspeisung gesamt",
      data: monthly.map((m) => m.pv_grid_mwh ?? 0),
      color: ENERGY_COLORS.dark_blue,
      kind: "line",
    },
  ];

  if (isGrey) {
    series.splice(3, 0, {
      name: "Netz → Batterie",
      data: monthly.map((m) => m.grid_to_battery_mwh ?? 0),
      color: ENERGY_COLORS.light_blue,
      kind: "bar",
    });
  }

  return {
    months: monthly.map((m) => m.month_label),
    series,
  };
}

function mwhTooltip(value: number): string {
  return `${formatNumber(value, 1)} MWh`;
}

function isPvStackBar(series: ChartSeries): boolean {
  return series.kind === "bar" && PV_STACK_NAMES.has(series.name);
}

export function buildEnergyChartOption(payload: ChartPayload): Record<string, unknown> {
  const visibleSeries = payload.series.filter((s) => s.data.some((v) => Math.abs(v) > 1e-6));

  return {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      valueFormatter: (v: number) => mwhTooltip(v),
    },
    legend: { bottom: 0 },
    grid: { left: 70, right: 20, top: 20, bottom: 60 },
    xAxis: { type: "category", data: payload.months },
    yAxis: {
      type: "value",
      name: "MWh",
      axisLabel: {
        formatter: (v: number) =>
          new Intl.NumberFormat("de-DE", { notation: "compact", maximumFractionDigits: 1 }).format(v),
      },
    },
    series: visibleSeries.map((s) => ({
      name: s.name,
      type: s.kind === "line" ? "line" : "bar",
      stack: isPvStackBar(s) ? "pv" : undefined,
      data: s.data.map((v) => Math.round(v * 10) / 10),
      itemStyle: { color: s.color ?? ENERGY_COLORS.medium_blue },
      ...(s.kind === "line"
        ? {
            symbol: "circle",
            symbolSize: 6,
            lineStyle: { width: 2 },
          }
        : {}),
    })),
  };
}

export function buildEnergySankeyOption(
  monthly: BacktestingMonthlyRecord[],
  useCase: string,
): Record<string, unknown> | null {
  const isGrey = useCase === "colocation_grey";
  const flows = aggregateSankeyFlows(monthly, isGrey);

  if (flows.pv_gross <= 0) {
    return null;
  }

  const nodes = [
    { name: "PV", itemStyle: { color: ENERGY_COLORS.medium_green } },
    { name: "Batterie", itemStyle: { color: ENERGY_COLORS.medium_orange } },
    { name: "Netz", itemStyle: { color: ENERGY_COLORS.medium_blue } },
    { name: "Abregelung", itemStyle: { color: ENERGY_COLORS.dark_orange } },
    { name: "Verlust", itemStyle: { color: ENERGY_COLORS.dark_orange } },
  ];

  const links: { source: string; target: string; value: number }[] = [
    { source: "PV", target: "Netz", value: flows.pv_direct },
    { source: "PV", target: "Batterie", value: flows.pv_to_batt },
    { source: "PV", target: "Abregelung", value: flows.curtail },
    { source: "Batterie", target: "Netz", value: flows.batt_to_grid },
    { source: "Batterie", target: "Verlust", value: flows.batt_loss },
  ];

  if (isGrey && flows.grid_to_batt > 0) {
    links.push({ source: "Netz", target: "Batterie", value: flows.grid_to_batt });
  }

  const activeLinks = links.filter((l) => l.value > 1e-6);
  if (activeLinks.length === 0) {
    return null;
  }

  return {
    tooltip: {
      trigger: "item",
      formatter: (params: { data?: { source?: string; target?: string; value?: number }; name?: string }) => {
        const data = params.data;
        if (data?.source && data.target && typeof data.value === "number") {
          return `${data.source} → ${data.target}<br/>${mwhTooltip(data.value)}`;
        }
        return params.name ?? "";
      },
    },
    series: [
      {
        type: "sankey",
        layoutIterations: 32,
        emphasis: { focus: "adjacency" },
        nodeAlign: "justify",
        lineStyle: { color: "gradient", curveness: 0.5, opacity: 0.45 },
        label: { fontSize: 12 },
        data: nodes,
        links: activeLinks,
      },
    ],
  };
}

export function buildCyclesChartOption(monthly: BacktestingMonthlyRecord[]): Record<string, unknown> {
  const months = monthly.map((m) => m.month_label);
  const cycles = monthly.map((m) => Math.round((m.avg_daily_cycles ?? 0) * 100) / 100);

  return {
    tooltip: {
      trigger: "axis",
      valueFormatter: (v: number) => formatNumber(v, 2),
    },
    grid: { left: 50, right: 16, top: 16, bottom: 40 },
    xAxis: { type: "category", data: months },
    yAxis: {
      type: "value",
      name: "Zyklen/Tag",
      min: 0,
      axisLabel: {
        formatter: (v: number) => formatNumber(v, 1),
      },
    },
    series: [
      {
        name: "Ø Vollzyklen/Tag",
        type: "bar",
        data: cycles,
        itemStyle: { color: ENERGY_COLORS.dark_blue },
        barMaxWidth: 28,
      },
    ],
  };
}
