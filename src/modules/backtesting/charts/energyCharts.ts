import type { BacktestingMonthlyRecord, ChartPayload, ChartSeries } from "../../../api/types";
import { formatNumber } from "../../offers/format";
import { COLORS, monthlyBase } from "./theme";

export const ENERGY_COLORS = {
  dark_blue: "#001A70",
  medium_blue: "#1057C8",
  light_blue: "#1089FF",
  medium_orange: "#FF861D",
  medium_green: "#88D910",
  dark_orange: "#FE5716",
  light_orange: "#FFB210",
  dark_green: "#4F9E30",
} as const;

const PV_STACK_NAMES = new Set(["PV direkt", "PV → Batterie", "Abregelung"]);

const SANKEY_FONT =
  'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

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
    ...monthlyBase(payload.months, "mwh", { axisName: "MWh" }),
    series: visibleSeries.map((s) => ({
      name: s.name,
      type: s.kind === "line" ? "line" : "bar",
      stack: isPvStackBar(s) ? "pv" : undefined,
      data: s.data.map((v) => Math.round(v * 10) / 10),
      itemStyle: {
        color: s.color ?? ENERGY_COLORS.medium_blue,
        ...(isPvStackBar(s) ? {} : { borderRadius: [3, 3, 0, 0] }),
      },
      barMaxWidth: 46,
      ...(s.kind === "line"
        ? { symbol: "circle", symbolSize: 6, lineStyle: { width: 2.2 }, z: 5 }
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

  const total = flows.pv_gross + (isGrey ? flows.grid_to_batt : 0);
  const share = (v: number) => (total > 0 ? `${formatNumber((v / total) * 100, 1)} %` : "");

  interface Node {
    name: string;
    itemStyle: { color: string; borderRadius: number };
    label?: Record<string, unknown>;
  }

  const node = (name: string, color: string, position: "left" | "right"): Node => ({
    name,
    itemStyle: { color, borderRadius: 3 },
    label: { position },
  });

  const nodes: Node[] = [
    node("PV brutto", ENERGY_COLORS.medium_green, "left"),
    node("Batterie", ENERGY_COLORS.medium_orange, "right"),
    node("Netzeinspeisung", ENERGY_COLORS.dark_blue, "right"),
    node("Abregelung", ENERGY_COLORS.light_orange, "right"),
    node("Verlust", ENERGY_COLORS.dark_orange, "right"),
  ];

  const links: { source: string; target: string; value: number }[] = [
    { source: "PV brutto", target: "Netzeinspeisung", value: flows.pv_direct },
    { source: "PV brutto", target: "Batterie", value: flows.pv_to_batt },
    { source: "PV brutto", target: "Abregelung", value: flows.curtail },
    { source: "Batterie", target: "Netzeinspeisung", value: flows.batt_to_grid },
    { source: "Batterie", target: "Verlust", value: flows.batt_loss },
  ];

  // Grau: Netzbezug speist die Batterie. Das darf NICHT auf denselben
  // Netz-Knoten zeigen wie die Einspeisung — Sankey kennt keine Zyklen.
  if (isGrey && flows.grid_to_batt > 0) {
    nodes.unshift(node("Netzbezug", ENERGY_COLORS.light_blue, "left"));
    links.push({ source: "Netzbezug", target: "Batterie", value: flows.grid_to_batt });
  }

  const activeLinks = links.filter((l) => l.value > 1e-6);
  if (activeLinks.length === 0) {
    return null;
  }

  const used = new Set<string>();
  activeLinks.forEach((l) => {
    used.add(l.source);
    used.add(l.target);
  });
  const activeNodes = nodes.filter((n) => used.has(n.name));

  const valueByNode = new Map<string, number>();
  activeNodes.forEach((n) => {
    const incoming = activeLinks
      .filter((l) => l.target === n.name)
      .reduce((a, l) => a + l.value, 0);
    const outgoing = activeLinks
      .filter((l) => l.source === n.name)
      .reduce((a, l) => a + l.value, 0);
    valueByNode.set(n.name, Math.max(incoming, outgoing));
  });

  return {
    textStyle: { fontFamily: SANKEY_FONT, color: "#0F1C3F" },
    animationDuration: 480,
    tooltip: {
      trigger: "item",
      backgroundColor: "rgba(255,255,255,0.98)",
      borderColor: "#DFE5F2",
      borderWidth: 1,
      padding: [8, 11],
      textStyle: { color: "#0F1C3F", fontSize: 12, fontFamily: SANKEY_FONT },
      extraCssText: "box-shadow:0 6px 22px rgba(15,28,63,.13);border-radius:9px;",
      formatter: (params: {
        dataType?: string;
        data?: { source?: string; target?: string; value?: number; name?: string };
        name?: string;
      }) => {
        const d = params.data;
        if (params.dataType === "edge" && d?.source && d.target && typeof d.value === "number") {
          return `${d.source} → ${d.target}<br/><b>${mwhTooltip(d.value)}</b> · ${share(d.value)}`;
        }
        const name = d?.name ?? params.name ?? "";
        const v = valueByNode.get(name);
        return v === undefined
          ? name
          : `<b>${name}</b><br/>${mwhTooltip(v)} · ${share(v)}`;
      },
    },
    series: [
      {
        type: "sankey",
        left: 142,
        right: 150,
        top: 16,
        bottom: 16,
        nodeWidth: 13,
        nodeGap: 14,
        layoutIterations: 32,
        nodeAlign: "justify",
        draggable: false,
        emphasis: { focus: "adjacency" },
        blur: { itemStyle: { opacity: 0.25 }, lineStyle: { opacity: 0.08 } },
        lineStyle: { color: "gradient", curveness: 0.5, opacity: 0.42 },
        label: {
          fontFamily: SANKEY_FONT,
          fontSize: 12,
          color: "#0F1C3F",
          // Kleine helle Plakette, damit die Beschriftung ueber den Baendern
          // lesbar bleibt, ohne sie zu verdecken.
          backgroundColor: "rgba(255,255,255,0.88)",
          padding: [3, 6],
          borderRadius: 5,
          formatter: (p: { name: string }) => {
            const v = valueByNode.get(p.name);
            return v === undefined
              ? `{n|${p.name}}`
              : `{n|${p.name}}\n{v|${formatNumber(v, 0)} MWh · ${share(v)}}`;
          },
          rich: {
            n: { fontSize: 12, fontWeight: 600, color: "#0F1C3F", lineHeight: 15 },
            v: { fontSize: 11, color: "#6B7899", lineHeight: 14 },
          },
        },
        data: activeNodes,
        links: activeLinks,
      },
    ],
  };
}

export function buildCyclesChartOption(monthly: BacktestingMonthlyRecord[]): Record<string, unknown> {
  const months = monthly.map((m) => m.month_label);
  const cycles = monthly.map((m) => Math.round((m.avg_daily_cycles ?? 0) * 100) / 100);
  const avg = cycles.length ? cycles.reduce((a, b) => a + b, 0) / cycles.length : 0;

  return {
    ...monthlyBase(months, "cycles", { showLegend: false, axisName: "Zyklen/Tag" }),
    series: [
      {
        name: "Ø Vollzyklen/Tag",
        type: "bar",
        data: cycles,
        itemStyle: { color: COLORS.blueDark, borderRadius: [3, 3, 0, 0] },
        barMaxWidth: 30,
        markLine: {
          silent: true,
          symbol: "none",
          lineStyle: { color: COLORS.orangeDark, width: 1.4, type: "dashed" },
          label: {
            formatter: `Jahresmittel ${formatNumber(avg, 2)}`,
            color: COLORS.orangeDark,
            fontSize: 11,
            position: "insideEndTop",
          },
          data: [{ yAxis: avg }],
        },
      },
    ],
  };
}
