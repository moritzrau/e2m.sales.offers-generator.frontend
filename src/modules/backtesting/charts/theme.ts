/**
 * Gemeinsames Chart-Theme fuer das Backtesting-Modul.
 *
 * Vorher hat jede Chart-Datei Achsen, Legenden, Raster, Tooltips und
 * Zahlenformate selbst zusammengesetzt — mit leicht unterschiedlichen Werten.
 * Ab hier gilt: Farben und Grundoptionen kommen von hier, die einzelnen
 * Builder liefern nur noch die Serien.
 */

/** Marken-/Semantikfarben, identisch zum PPT-Export (style.py). */
export const COLORS = {
  greenDark: "#4F9E30",
  green: "#88D910",
  greenLight: "#C0E410",
  blueDark: "#001A70",
  blue: "#1057C8",
  blueLight: "#1089FF",
  orange: "#FF861D",
  orangeLight: "#FFB210",
  orangeDark: "#FE5716",
  ink: "#0F1C3F",
  ink2: "#33406A",
  muted: "#6B7899",
  grid: "#EDF1F8",
  line: "#DFE5F2",
  surface: "#FFFFFF",
} as const;

export const FONT_FAMILY =
  'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

/* ------------------------------------------------------------------ */
/* Zahlenformate — deutsch, an genau einer Stelle                       */
/* ------------------------------------------------------------------ */

const NF0 = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });
const NF1 = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });
const NF2 = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 });

/** Kompakte Achsenbeschriftung: 1.189.561 → "1,19 Mio.", 83.742 → "84k". */
export function compactEur(v: number): string {
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${NF2.format(v / 1_000_000)} Mio.`;
  if (a >= 1_000) return `${NF0.format(v / 1_000)}k`;
  return NF0.format(v);
}

export function eur(v: number): string {
  return `${NF0.format(v)} €`;
}

export function mwh(v: number): string {
  return `${NF0.format(v)} MWh`;
}

export function mw(v: number, decimals = 2): string {
  return `${(decimals === 1 ? NF1 : NF2).format(v)} MW`;
}

export function eurPerMwh(v: number): string {
  return `${NF0.format(v)} €/MWh`;
}

/* ------------------------------------------------------------------ */
/* Grundbausteine                                                       */
/* ------------------------------------------------------------------ */

export const textStyle = {
  fontFamily: FONT_FAMILY,
  color: COLORS.ink,
} as const;

/** Tooltip mit heller Karte statt ECharts-Standardgrau. */
export function tooltip(extra: Record<string, unknown> = {}) {
  return {
    backgroundColor: "rgba(255,255,255,0.98)",
    borderColor: COLORS.line,
    borderWidth: 1,
    padding: [8, 11],
    textStyle: { color: COLORS.ink, fontSize: 12, fontFamily: FONT_FAMILY },
    extraCssText: "box-shadow:0 6px 22px rgba(15,28,63,.13);border-radius:9px;",
    ...extra,
  };
}

/** Legende unten, ohne Rahmen, mit runden Markern. */
export function legend(extra: Record<string, unknown> = {}) {
  return {
    bottom: 0,
    itemWidth: 10,
    itemHeight: 10,
    itemGap: 16,
    icon: "roundRect",
    textStyle: { color: COLORS.ink2, fontSize: 11.5, fontFamily: FONT_FAMILY },
    ...extra,
  };
}

export function categoryAxis(data: string[], extra: Record<string, unknown> = {}) {
  return {
    type: "category",
    data,
    boundaryGap: true,
    axisLine: { lineStyle: { color: COLORS.line } },
    axisTick: { show: false },
    axisLabel: { color: COLORS.muted, fontSize: 11, fontFamily: FONT_FAMILY },
    ...extra,
  };
}

export function valueAxis(
  formatter: (v: number) => string,
  extra: Record<string, unknown> = {},
) {
  return {
    type: "value",
    axisLine: { show: false },
    axisTick: { show: false },
    splitLine: { lineStyle: { color: COLORS.grid } },
    axisLabel: { color: COLORS.muted, fontSize: 11, fontFamily: FONT_FAMILY, formatter },
    nameTextStyle: { color: COLORS.muted, fontSize: 11, fontFamily: FONT_FAMILY, align: "left" },
    nameGap: 12,
    ...extra,
  };
}

/**
 * Basisgeruest fuer ein Monatschart: Achsen, Raster, Tooltip, Legende.
 * `unit` steuert Achsen- und Tooltipformat.
 */
export function monthlyBase(
  months: string[],
  unit: "eur" | "mwh" | "cycles" | "eurPerMwh",
  opts: { showLegend?: boolean; axisName?: string } = {},
) {
  const fmt =
    unit === "eur"
      ? { axis: compactEur, tip: eur }
      : unit === "mwh"
        ? { axis: (v: number) => NF0.format(v), tip: mwh }
        : unit === "eurPerMwh"
          ? { axis: (v: number) => NF0.format(v), tip: eurPerMwh }
          : { axis: (v: number) => NF1.format(v), tip: (v: number) => NF2.format(v) };

  const showLegend = opts.showLegend !== false;
  return {
    textStyle,
    animationDuration: 420,
    tooltip: tooltip({
      trigger: "axis",
      axisPointer: { type: "shadow", shadowStyle: { color: "rgba(0,26,112,.05)" } },
      valueFormatter: (v: number) => fmt.tip(v),
    }),
    legend: showLegend ? legend() : { show: false },
    grid: {
      left: 8,
      right: 16,
      top: opts.axisName ? 30 : 16,
      bottom: showLegend ? 34 : 8,
      containLabel: true,
    },
    xAxis: categoryAxis(months),
    yAxis: valueAxis(fmt.axis, opts.axisName ? { name: opts.axisName } : {}),
  };
}

/** Serien mit ausschliesslich Nullwerten ausblenden. */
export function isNonZero(data: number[]): boolean {
  return data.some((v) => Math.abs(v) > 1e-6);
}
