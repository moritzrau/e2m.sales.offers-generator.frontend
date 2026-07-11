/** Deutsche Zahlenformatierung — Frontend zeigt nur an, Backend rechnet. */

const EUR_FORMAT = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const NUMBER_FORMAT_0 = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });
const NUMBER_FORMAT_2 = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 });

export function formatEUR(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return EUR_FORMAT.format(value);
}

export function formatNumber(value: number | null | undefined, decimals: 0 | 2 = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return (decimals === 0 ? NUMBER_FORMAT_0 : NUMBER_FORMAT_2).format(value);
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
