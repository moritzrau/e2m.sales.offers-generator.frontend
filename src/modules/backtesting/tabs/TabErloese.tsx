import { useMemo } from "react";
import ReactECharts from "echarts-for-react";

import type { BacktestingAnalyzeResult } from "../../../api/types";
import { formatEUR } from "../../offers/format";
import { buildSpreadAreaOption } from "../charts/overviewCharts";
import {
  buildCumulativeRevenueOption,
  buildGreenComparisonOption,
  buildRevenueChartOption,
  buildRevenueChartPayloadFromMonthly,
  buildRevenueShareDonutOption,
  REVENUE_COLORS,
  sumMonthlyField,
  type GreenRevenueMonthly,
} from "../charts/revenueCharts";

interface TabErloeseProps {
  result: BacktestingAnalyzeResult;
  greenRevenue?: { monthly: GreenRevenueMonthly[] } | null;
}

export function TabErloese({ result, greenRevenue }: TabErloeseProps) {
  const isGreen = result.use_case === "colocation_green";
  const isGrey = result.use_case === "colocation_grey";
  const isStandalone = result.use_case === "standalone_bess";
  const rows = result.monthly;

  const mainChartOption = useMemo(() => {
    const payload = result.revenue_chart ?? buildRevenueChartPayloadFromMonthly(result);
    return buildRevenueChartOption(payload);
  }, [result]);

  const showDonut = isGrey || isStandalone;
  const donutOption = useMemo(() => {
    if (!showDonut) return null;
    const slices = isGrey
      ? [
          { name: "PV-Erlös (DA)", value: sumMonthlyField(rows, "pv_revenue_eur"), color: REVENUE_COLORS.medium_green },
          { name: "FCR", value: sumMonthlyField(rows, "fcr_eur"), color: REVENUE_COLORS.dark_blue },
          { name: "aFRR positiv", value: sumMonthlyField(rows, "afrr_pos_eur"), color: REVENUE_COLORS.medium_blue },
          { name: "aFRR negativ", value: sumMonthlyField(rows, "afrr_neg_eur"), color: REVENUE_COLORS.light_blue },
          { name: "Wholesale", value: sumMonthlyField(rows, "wholesale_eur"), color: REVENUE_COLORS.medium_orange },
        ]
      : [
          { name: "FCR", value: sumMonthlyField(rows, "fcr_eur"), color: REVENUE_COLORS.dark_blue },
          { name: "aFRR positiv", value: sumMonthlyField(rows, "afrr_pos_eur"), color: REVENUE_COLORS.medium_blue },
          { name: "aFRR negativ", value: sumMonthlyField(rows, "afrr_neg_eur"), color: REVENUE_COLORS.light_blue },
          { name: "Wholesale", value: sumMonthlyField(rows, "wholesale_eur"), color: REVENUE_COLORS.medium_orange },
        ];
    return buildRevenueShareDonutOption(slices);
  }, [isGrey, rows, showDonut]);

  const spreadOption = useMemo(() => buildSpreadAreaOption(rows), [rows]);

  const showGreenComparison = isGreen && greenRevenue != null && greenRevenue.monthly.length > 0;
  const greenComparisonOption = useMemo(
    () => (showGreenComparison && greenRevenue ? buildGreenComparisonOption(greenRevenue.monthly) : null),
    [greenRevenue, showGreenComparison],
  );

  const cumulativeOption = useMemo(() => buildCumulativeRevenueOption(rows), [rows]);

  const showFcr = (isStandalone || isGrey) && rows.some((r) => r.fcr_eur !== 0);
  const showAfrrPos = (isStandalone || isGrey) && rows.some((r) => r.afrr_pos_eur !== 0);
  const showAfrrNeg = (isStandalone || isGrey) && rows.some((r) => r.afrr_neg_eur !== 0);
  const showWholesale = (isStandalone || isGrey) && rows.some((r) => r.wholesale_eur !== 0);
  const showPvRevenue = isGrey && rows.some((r) => r.pv_revenue_eur !== 0);
  const showGrundverguetung = isGreen && rows.some((r) => r.grundverguetung !== 0);
  const showMehrerloese = isGreen && rows.some((r) => r.mehrerloese_brutto !== 0);
  const showEeg = isGreen && rows.some((r) => r.eeg_revenue_eur !== 0);

  const totals = {
    grundverguetung: sumMonthlyField(rows, "grundverguetung"),
    mehrerloese: sumMonthlyField(rows, "mehrerloese_brutto"),
    eeg: sumMonthlyField(rows, "eeg_revenue_eur"),
    pv: sumMonthlyField(rows, "pv_revenue_eur"),
    fcr: sumMonthlyField(rows, "fcr_eur"),
    afrrPos: sumMonthlyField(rows, "afrr_pos_eur"),
    afrrNeg: sumMonthlyField(rows, "afrr_neg_eur"),
    wholesale: sumMonthlyField(rows, "wholesale_eur"),
    total: sumMonthlyField(rows, "total_revenue_eur"),
  };

  return (
    <div>
      <section className="bt-section">
        <div className="bt-section__head">
          <h4>Monatliche Erlöse</h4>
          <p>Gestapelte Bestandteile je Monat, Linie = Gesamterlös.</p>
        </div>
        <div className="bt-card">
          <ReactECharts option={mainChartOption} style={{ height: 380 }} notMerge lazyUpdate />
        </div>
      </section>

      {greenComparisonOption && (
        <section className="bt-section">
          <div className="bt-section__head">
            <h4>Co-Location gegen PV-only</h4>
            <p>
              Was die Anlage ohne Speicher verdient hätte, gegen das, was sie mit Speicher
              verdient — die Linie ist die Differenz.
            </p>
          </div>
          <div className="bt-card">
            <ReactECharts option={greenComparisonOption} style={{ height: 340 }} notMerge lazyUpdate />
          </div>
        </section>
      )}

      {spreadOption && (
        <section className="bt-section">
          <div className="bt-section__head">
            <h4>Arbitrage-Spread</h4>
            <p>
              Ø Lade- und Entladepreis je Monat. <b>Die eingefärbte Fläche dazwischen ist die
              Marge</b>, aus der die Wholesale-Erlöse entstehen.
            </p>
          </div>
          <div className="bt-card">
            <ReactECharts option={spreadOption} style={{ height: 330 }} notMerge lazyUpdate />
          </div>
        </section>
      )}

      <section className="bt-section">
        <div className={donutOption ? "bt-grid-2" : ""}>
          {donutOption && (
            <div className="bt-card">
              <p className="bt-card__title">Erlösanteile im Jahr</p>
              <p className="bt-card__sub">Anteil der Vermarktungswege am Gesamterlös.</p>
              <ReactECharts option={donutOption} style={{ height: 320 }} notMerge lazyUpdate />
            </div>
          )}
          <div className="bt-card">
            <p className="bt-card__title">Kumulierter Jahreserlös</p>
            <p className="bt-card__sub">Auflaufende Summe über das Jahr.</p>
            <ReactECharts option={cumulativeOption} style={{ height: 320 }} notMerge lazyUpdate />
          </div>
        </div>
      </section>

      <section className="bt-section">
        <details>
          <summary className="muted" style={{ cursor: "pointer" }}>
            Monatstabelle anzeigen
          </summary>
          <div className="bt-table-wrap">
            <table className="bt-table">
              <thead>
                <tr>
                  <th>Monat</th>
                  {showGrundverguetung && <th>Grundvergütung</th>}
                  {showMehrerloese && <th>Mehrerlöse</th>}
                  {showEeg && <th>EEG-Marktprämie</th>}
                  {showPvRevenue && <th>PV-Erlös (DA)</th>}
                  {showFcr && <th>FCR</th>}
                  {showAfrrPos && <th>aFRR positiv</th>}
                  {showAfrrNeg && <th>aFRR negativ</th>}
                  {showWholesale && <th>Wholesale</th>}
                  <th>Gesamt</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.month}>
                    <td>{row.month_label}</td>
                    {showGrundverguetung && <td>{formatEUR(row.grundverguetung)}</td>}
                    {showMehrerloese && <td>{formatEUR(row.mehrerloese_brutto)}</td>}
                    {showEeg && <td>{formatEUR(row.eeg_revenue_eur)}</td>}
                    {showPvRevenue && <td>{formatEUR(row.pv_revenue_eur)}</td>}
                    {showFcr && <td>{formatEUR(row.fcr_eur)}</td>}
                    {showAfrrPos && <td>{formatEUR(row.afrr_pos_eur)}</td>}
                    {showAfrrNeg && <td>{formatEUR(row.afrr_neg_eur)}</td>}
                    {showWholesale && <td>{formatEUR(row.wholesale_eur)}</td>}
                    <td>{formatEUR(row.total_revenue_eur)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Jahr</td>
                  {showGrundverguetung && <td>{formatEUR(totals.grundverguetung)}</td>}
                  {showMehrerloese && <td>{formatEUR(totals.mehrerloese)}</td>}
                  {showEeg && <td>{formatEUR(totals.eeg)}</td>}
                  {showPvRevenue && <td>{formatEUR(totals.pv)}</td>}
                  {showFcr && <td>{formatEUR(totals.fcr)}</td>}
                  {showAfrrPos && <td>{formatEUR(totals.afrrPos)}</td>}
                  {showAfrrNeg && <td>{formatEUR(totals.afrrNeg)}</td>}
                  {showWholesale && <td>{formatEUR(totals.wholesale)}</td>}
                  <td>{formatEUR(totals.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </details>
      </section>
    </div>
  );
}
