/** Deutsche Zahlenformatierung — Frontend zeigt nur an, Backend rechnet. */

const EUR_FORMAT = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const NUMBER_FORMAT_0 = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });
const NUMBER_FORMAT_1 = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const NUMBER_FORMAT_2 = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 });

const NUMBER_FORMATS: Record<0 | 1 | 2, Intl.NumberFormat> = {
  0: NUMBER_FORMAT_0,
  1: NUMBER_FORMAT_1,
  2: NUMBER_FORMAT_2,
};

const PERCENT_FORMAT_1 = new Intl.NumberFormat("de-DE", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function formatEUR(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return EUR_FORMAT.format(value);
}

export function formatNumber(
  value: number | null | undefined,
  decimals: 0 | 1 | 2 = 2,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return NUMBER_FORMATS[decimals].format(value);
}

/** Anteil als Prozent — Eingabe ist ein Bruch (0,84 → "84,0 %"). */
export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return PERCENT_FORMAT_1.format(value);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const DE_TS = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDateTime(isoString: string): string {
  return DE_TS.format(new Date(isoString));
}
