import { useMemo } from "react";
import ReactECharts from "echarts-for-react";

import type { BacktestingAnalyzeResult } from "../../../api/types";
import { formatEUR } from "../../offers/format";
import {
  buildArbitrageSpreadOption,
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
    if (isGrey) {
      return buildRevenueShareDonutOption([
        {
          name: "PV-Erlös (DA)",
          value: sumMonthlyField(rows, "pv_revenue_eur"),
          color: REVENUE_COLORS.medium_green,
        },
        {
          name: "FCR",
          value: sumMonthlyField(rows, "fcr_eur"),
          color: REVENUE_COLORS.dark_blue,
        },
        {
          name: "aFRR positiv",
          value: sumMonthlyField(rows, "afrr_pos_eur"),
          color: REVENUE_COLORS.medium_blue,
        },
        {
          name: "aFRR negativ",
          value: sumMonthlyField(rows, "afrr_neg_eur"),
          color: REVENUE_COLORS.light_blue,
        },
        {
          name: "Wholesale",
          value: sumMonthlyField(rows, "wholesale_eur"),
          color: REVENUE_COLORS.medium_orange,
        },
      ]);
    }
    return buildRevenueShareDonutOption([
      {
        name: "FCR",
        value: sumMonthlyField(rows, "fcr_eur"),
        color: REVENUE_COLORS.dark_blue,
      },
      {
        name: "aFRR positiv",
        value: sumMonthlyField(rows, "afrr_pos_eur"),
        color: REVENUE_COLORS.medium_blue,
      },
      {
        name: "aFRR negativ",
        value: sumMonthlyField(rows, "afrr_neg_eur"),
        color: REVENUE_COLORS.light_blue,
      },
      {
        name: "Wholesale",
        value: sumMonthlyField(rows, "wholesale_eur"),
        color: REVENUE_COLORS.medium_orange,
      },
    ]);
  }, [isGrey, rows, showDonut]);

  const showSpread = rows.some((m) => (m.avg_discharge_price ?? 0) !== 0);
  const spreadOption = useMemo(
    () => (showSpread ? buildArbitrageSpreadOption(rows) : null),
    [rows, showSpread],
  );

  const showGreenComparison = isGreen && greenRevenue != null && greenRevenue.monthly.length > 0;
  const greenComparisonOption = useMemo(
    () =>
      showGreenComparison && greenRevenue
        ? buildGreenComparisonOption(greenRevenue.monthly)
        : null,
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

  return (
    <div>
      <h4 style={{ marginTop: 0 }}>Monatliche Erlöse</h4>
      <ReactECharts option={mainChartOption} style={{ height: 360 }} notMerge lazyUpdate />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "1.25rem",
          marginTop: "1.25rem",
        }}
      >
        {donutOption && (
          <div>
            <h4 style={{ marginTop: 0 }}>Erlösanteile</h4>
            <ReactECharts option={donutOption} style={{ height: 300 }} notMerge lazyUpdate />
          </div>
        )}

        {spreadOption && (
          <div>
            <h4 style={{ marginTop: 0 }}>Arbitrage-Spread</h4>
            <ReactECharts option={spreadOption} style={{ height: 300 }} notMerge lazyUpdate />
          </div>
        )}

        {greenComparisonOption && (
          <div style={{ gridColumn: "1 / -1" }}>
            <h4 style={{ marginTop: 0 }}>CoLocation vs. PV-only</h4>
            <ReactECharts
              option={greenComparisonOption}
              style={{ height: 320 }}
              notMerge
              lazyUpdate
            />
          </div>
        )}
      </div>

      <h4 style={{ marginTop: "1.25rem" }}>Kumulierter Jahreserlös</h4>
      <ReactECharts option={cumulativeOption} style={{ height: 260 }} notMerge lazyUpdate />

      <details style={{ marginTop: "1rem" }}>
        <summary className="muted">Monatstabelle</summary>
        <table className="offers-table" style={{ marginTop: "0.5rem" }}>
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
        </table>
      </details>
    </div>
  );
}
