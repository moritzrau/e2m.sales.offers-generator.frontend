import type { BacktestingAnalyzeResult, BacktestingMonthlyRecord } from "../../../api/types";
import { formatEUR, formatNumber } from "../../offers/format";
import { COLORS } from "../charts/theme";
import { Sparkline } from "./Sparkline";

export interface SplitSegment {
  name: string;
  value: number;
  color: string;
}

function sumField(
  monthly: BacktestingMonthlyRecord[],
  field: keyof BacktestingMonthlyRecord,
): number {
  return monthly.reduce((acc, r) => {
    const v = r[field];
    return acc + (typeof v === "number" && Number.isFinite(v) ? v : 0);
  }, 0);
}

/** Erloesbestandteile je Use Case — dieselbe Reihenfolge wie im Wasserfall. */
export function splitSegments(result: BacktestingAnalyzeResult): SplitSegment[] {
  const m = result.monthly;
  const segs: SplitSegment[] =
    result.use_case === "colocation_green"
      ? [
          { name: "Grundvergütung", value: sumField(m, "grundverguetung"), color: COLORS.blue },
          { name: "Mehrerlöse", value: sumField(m, "mehrerloese_brutto"), color: COLORS.orange },
          { name: "EEG-Marktprämie", value: sumField(m, "eeg_revenue_eur"), color: COLORS.green },
        ]
      : result.use_case === "colocation_grey"
        ? [
            { name: "PV-Erlös", value: sumField(m, "pv_revenue_eur"), color: COLORS.green },
            { name: "FCR", value: sumField(m, "fcr_eur"), color: COLORS.blueDark },
            {
              name: "aFRR",
              value: sumField(m, "afrr_pos_eur") + sumField(m, "afrr_neg_eur"),
              color: COLORS.blue,
            },
            { name: "Wholesale", value: sumField(m, "wholesale_eur"), color: COLORS.orange },
          ]
        : [
            { name: "FCR", value: sumField(m, "fcr_eur"), color: COLORS.blueDark },
            {
              name: "aFRR",
              value: sumField(m, "afrr_pos_eur") + sumField(m, "afrr_neg_eur"),
              color: COLORS.blue,
            },
            { name: "Wholesale", value: sumField(m, "wholesale_eur"), color: COLORS.orange },
          ];
  return segs.filter((s) => Math.abs(s.value) > 1);
}

function yearOf(result: BacktestingAnalyzeResult): string {
  const first = result.monthly[0]?.month;
  return first ? first.slice(0, 4) : "";
}

interface Props {
  result: BacktestingAnalyzeResult;
}

export function ResultHero({ result }: Props) {
  const s = result.scaled_sizes;
  const segments = splitSegments(result);
  const segTotal = segments.reduce((a, x) => a + Math.max(x.value, 0), 0);
  const monthlyTotals = result.monthly.map((m) => m.total_revenue_eur);
  const year = yearOf(result);

  const perMwh = result.kpis.eur_per_mwh_storage;
  const cycles = result.kpis.avg_daily_cycles;
  const pvGross = result.kpis.pv_gross_mwh;

  return (
    <div className="bt-hero">
      <div className="bt-hero__top">
        <div style={{ minWidth: 0 }}>
          <p className="bt-hero__eyebrow">Gesamterlös{year ? ` ${year}` : ""}</p>
          <p className="bt-hero__value">{formatEUR(result.kpis.total_revenue_eur)}</p>
          <p className="bt-hero__facts">
            {perMwh != null && (
              <>
                <b>{formatNumber(perMwh, 0)} €/MWh</b> Speicher
              </>
            )}
            {cycles != null && (
              <>
                {perMwh != null ? " · " : ""}
                <b>{formatNumber(cycles, 2)}</b> Zyklen/Tag
              </>
            )}
            {pvGross != null && pvGross > 0 && (
              <>
                {" · "}
                <b>{formatNumber(pvGross, 0)} MWh</b> PV brutto
              </>
            )}
          </p>
          <p className="bt-hero__facts" style={{ marginTop: "0.15rem" }}>
            {result.label} · {result.duration_h} h
            {s.pv_mw !== null && s.pv_mw > 0 ? ` · ${formatNumber(s.pv_mw, 1)} MW PV` : ""}
            {` · ${formatNumber(s.bess_mw, 1)} MW / ${formatNumber(s.bess_mwh, 1)} MWh BESS`}
            {Math.abs(s.scale_factor - 1) > 0.001
              ? ` · skaliert ×${formatNumber(s.scale_factor, 2)}`
              : ""}
          </p>
        </div>
        <div className="bt-hero__aside">
          <Sparkline
            values={monthlyTotals}
            width={168}
            height={54}
            ariaLabel="Monatsverlauf des Gesamterlöses"
          />
          <span style={{ fontSize: "0.72rem", color: "var(--bt-muted)" }}>Monatsverlauf</span>
        </div>
      </div>

      {segments.length > 1 && segTotal > 0 && (
        <div className="bt-splitbar">
          <div className="bt-splitbar__track">
            {segments.map((seg) => (
              <div
                key={seg.name}
                className="bt-splitbar__seg"
                style={{
                  width: `${(Math.max(seg.value, 0) / segTotal) * 100}%`,
                  background: seg.color,
                }}
                title={`${seg.name}: ${formatEUR(seg.value)}`}
              />
            ))}
          </div>
          <div className="bt-splitbar__legend">
            {segments.map((seg) => (
              <span key={seg.name}>
                <i className="bt-swatch" style={{ background: seg.color }} />
                {seg.name} <b>{formatEUR(seg.value)}</b>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
