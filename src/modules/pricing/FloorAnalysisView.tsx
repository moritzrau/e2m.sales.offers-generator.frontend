import ReactECharts from "echarts-for-react";

import type { FloorAnalyzeResult } from "../../api/types";
import { formatEUR, formatNumber } from "../offers/format";

interface Props {
  result: FloorAnalyzeResult;
  multiplier: number;
  mode: "per_mw" | "total";
}

export function FloorAnalysisView({ result, multiplier, mode }: Props) {
  const scale = (v: number | null | undefined): number | null =>
    v === null || v === undefined ? null : v * multiplier;

  const years = result.e2m_per_year.map((r) => r.year);
  const e2mValues = result.e2m_per_year.map((r) => (scale(r.e2m_share) ?? 0));
  const customerValues = result.e2m_per_year.map((r) => (scale(r.customer_payout) ?? 0));
  const cumulativeValues = result.e2m_per_year.map((r) => (scale(r.e2m_cumulative_npv ?? 0) ?? 0));

  const suffix = mode === "total" ? "" : " / MW BESS";

  const stackedBarOption = {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    legend: { data: ["e2m", "Kunde"] },
    xAxis: { type: "category", data: years },
    yAxis: {
      type: "value",
      axisLabel: {
        formatter: (v: number) => new Intl.NumberFormat("de-DE").format(v),
      },
    },
    series: [
      {
        name: "Kunde",
        type: "bar",
        stack: "aufteilung",
        data: customerValues,
        itemStyle: { color: "#001a70" },
      },
      {
        name: "e2m",
        type: "bar",
        stack: "aufteilung",
        data: e2mValues,
        itemStyle: { color: "#fe5716" },
      },
    ],
  };

  const cumulativeOption = {
    tooltip: { trigger: "axis" },
    xAxis: { type: "category", data: years },
    yAxis: {
      type: "value",
      axisLabel: {
        formatter: (v: number) => new Intl.NumberFormat("de-DE").format(v),
      },
    },
    series: [
      {
        name: "Kumulierter e2m-NPV",
        type: "line",
        smooth: true,
        data: cumulativeValues,
        itemStyle: { color: "#001a70" },
        areaStyle: { color: "rgba(0, 26, 112, 0.08)" },
      },
    ],
  };

  const recommended = result.recommended_floor_eur_per_mw * multiplier;
  const chosen = result.chosen_floor_eur_per_mw * multiplier;
  const delta = chosen - recommended;
  const totalE2m = result.summary.total_e2m_eur_per_mw * multiplier;
  const totalKunde = result.summary.total_customer_eur_per_mw * multiplier;
  const npvTotal =
    result.summary.npv_e2m_eur_per_mw !== null
      ? result.summary.npv_e2m_eur_per_mw * multiplier
      : null;

  return (
    <div className="card" style={{ marginTop: "1rem" }}>
      <h3>Ergebnis</h3>
      <p className="muted" style={{ marginTop: 0 }}>
        {result.inputs.kombi_label} · PV {formatNumber(result.inputs.pv_mw, 2)} MW · BESS{" "}
        {formatNumber(result.inputs.bess_mw, 2)} MW · Basisjahr {result.basis.basisjahr} ·{" "}
        {result.basis.description}
      </p>

      <div className="kpi-grid">
        <div className="kpi-tile">
          <span className="muted">Empfohlener Floor{suffix}</span>
          <strong>{formatEUR(recommended)}</strong>
        </div>
        <div className="kpi-tile">
          <span className="muted">Gewählter Floor{suffix}</span>
          <strong>{formatEUR(chosen)}</strong>
          {delta !== 0 && (
            <span className={`badge ${delta > 0 ? "badge--info" : "badge--muted"}`}>
              {delta > 0 ? "+" : ""}
              {formatEUR(delta)} vs. Empfehlung
            </span>
          )}
        </div>
        <div className="kpi-tile">
          <span className="muted">Total e2m ({result.inputs.horizon_years} J.){suffix}</span>
          <strong>{formatEUR(totalE2m)}</strong>
        </div>
        <div className="kpi-tile">
          <span className="muted">Total Kunde{suffix}</span>
          <strong>{formatEUR(totalKunde)}</strong>
        </div>
        {npvTotal !== null && (
          <div className="kpi-tile">
            <span className="muted">
              NPV e2m ({formatNumber((result.inputs.discount_rate ?? 0) * 100, 2)} %){suffix}
            </span>
            <strong>{formatEUR(npvTotal)}</strong>
          </div>
        )}
      </div>

      {result.summary.compensation_years.length > 0 && (
        <p className="muted" style={{ marginTop: "0.75rem" }}>
          <span className="badge badge--info">Achtung</span> Ausgleichszahlungen in{" "}
          {result.summary.compensation_years.join(", ")}
        </p>
      )}
      {result.summary.negative_years.length > 0 && (
        <p className="muted" style={{ marginTop: "0.25rem" }}>
          <span className="badge badge--error">Verlust</span> Negatives e2m-Ergebnis in{" "}
          {result.summary.negative_years.join(", ")}
        </p>
      )}

      <h4 style={{ marginTop: "1.25rem" }}>Aufteilung pro Jahr</h4>
      <ReactECharts option={stackedBarOption} style={{ height: 320 }} notMerge />

      <h4 style={{ marginTop: "1.25rem" }}>Kumulierter e2m (NPV)</h4>
      <ReactECharts option={cumulativeOption} style={{ height: 260 }} notMerge />

      <details style={{ marginTop: "1rem" }}>
        <summary className="muted">Jahrestabelle</summary>
        <table className="offers-table" style={{ marginTop: "0.5rem" }}>
          <thead>
            <tr>
              <th>Jahr</th>
              <th>Scale</th>
              <th>Erlös{suffix}</th>
              <th>Kunde{suffix}</th>
              <th>e2m{suffix}</th>
            </tr>
          </thead>
          <tbody>
            {result.e2m_per_year.map((row, i) => {
              const rev = result.revenue_per_year[i];
              const negative = row.e2m_share < 0;
              return (
                <tr key={row.year}>
                  <td>{row.year}</td>
                  <td>{formatNumber(rev?.scale ?? 0, 2)}</td>
                  <td>{formatEUR((row.revenue_eur_per_mw ?? 0) * multiplier)}</td>
                  <td>{formatEUR((row.customer_payout ?? 0) * multiplier)}</td>
                  <td style={negative ? { color: "#991b1b", fontWeight: 600 } : undefined}>
                    {formatEUR((row.e2m_share ?? 0) * multiplier)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </details>
    </div>
  );
}
