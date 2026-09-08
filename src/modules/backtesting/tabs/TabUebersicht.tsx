import { useMemo } from "react";
import ReactECharts from "echarts-for-react";

import type { BacktestingAnalyzeResult } from "../../../api/types";
import { formatEUR, formatNumber } from "../../offers/format";
import { Sparkline } from "../components/Sparkline";
import {
  buildSpreadAreaOption,
  buildWaterfallOption,
  buildWaterfallSpec,
  waterfallHighlight,
} from "../charts/overviewCharts";
import { buildEnergySankeyOption } from "../charts/energyCharts";
import { buildRevenueChartOption, buildRevenueChartPayloadFromMonthly } from "../charts/revenueCharts";
import { COLORS } from "../charts/theme";

interface Props {
  result: BacktestingAnalyzeResult;
}

/**
 * Startansicht: vier Kernaussagen statt einer Chart-Halde.
 * Jede Kachel traegt eine Ueberschrift und einen deutenden Satz — Zahlen ohne
 * Deutung helfen im Kundengespraech nicht.
 */
export function TabUebersicht({ result }: Props) {
  const rows = result.monthly;

  const waterfall = useMemo(() => buildWaterfallSpec(result), [result]);
  const waterfallOption = useMemo(
    () => (waterfall ? buildWaterfallOption(waterfall) : null),
    [waterfall],
  );
  const waterfallNote = useMemo(
    () => (waterfall ? waterfallHighlight(waterfall) : null),
    [waterfall],
  );

  const sankeyOption = useMemo(
    () => buildEnergySankeyOption(rows, result.use_case),
    [rows, result.use_case],
  );

  const monthlyOption = useMemo(() => {
    const payload = result.revenue_chart ?? buildRevenueChartPayloadFromMonthly(result);
    return buildRevenueChartOption(payload);
  }, [result]);

  const spreadOption = useMemo(() => buildSpreadAreaOption(rows), [rows]);

  const best = useMemo(() => {
    let bi = 0;
    rows.forEach((r, i) => {
      if (r.total_revenue_eur > rows[bi].total_revenue_eur) bi = i;
    });
    return rows[bi];
  }, [rows]);

  const maxSpread = useMemo(() => {
    let bi = -1;
    let bv = -Infinity;
    rows.forEach((r, i) => {
      const sp = (r.avg_discharge_price ?? 0) - (r.avg_charge_price ?? 0);
      if ((r.avg_discharge_price ?? 0) !== 0 && sp > bv) {
        bv = sp;
        bi = i;
      }
    });
    return bi >= 0 ? { row: rows[bi], spread: bv } : null;
  }, [rows]);

  const kpis = result.kpis;

  return (
    <div>
      {/* Kennzahlen mit Verlauf */}
      <div className="bt-section">
        <div className="bt-stats">
          <div className="bt-stat">
            <span className="bt-stat__label">Bester Monat</span>
            <span className="bt-stat__value">{formatEUR(best.total_revenue_eur)}</span>
            <span className="bt-stat__label">{best.month_label}</span>
            <div className="bt-stat__spark">
              <Sparkline
                values={rows.map((r) => r.total_revenue_eur)}
                width={150}
                height={22}
                color={COLORS.blueDark}
              />
            </div>
          </div>

          {kpis.eur_per_mwh_storage != null && (
            <div className="bt-stat">
              <span className="bt-stat__label">Erlös je MWh Speicher</span>
              <span className="bt-stat__value">
                {formatNumber(kpis.eur_per_mwh_storage, 0)}
                <span className="bt-stat__unit">€/MWh</span>
              </span>
              <span className="bt-stat__label">Jahressumme / Kapazität</span>
            </div>
          )}

          {kpis.avg_daily_cycles != null && (
            <div className="bt-stat">
              <span className="bt-stat__label">Ø Vollzyklen</span>
              <span className="bt-stat__value">
                {formatNumber(kpis.avg_daily_cycles, 2)}
                <span className="bt-stat__unit">pro Tag</span>
              </span>
              <span className="bt-stat__label">Jahresmittel</span>
              <div className="bt-stat__spark">
                <Sparkline
                  values={rows.map((r) => r.avg_daily_cycles ?? 0)}
                  width={150}
                  height={22}
                  color={COLORS.orange}
                  fill="rgba(255,134,29,.16)"
                />
              </div>
            </div>
          )}

          {maxSpread && (
            <div className="bt-stat">
              <span className="bt-stat__label">Größter Spread</span>
              <span className="bt-stat__value">
                {formatNumber(maxSpread.spread, 0)}
                <span className="bt-stat__unit">€/MWh</span>
              </span>
              <span className="bt-stat__label">{maxSpread.row.month_label}</span>
            </div>
          )}
        </div>
      </div>

      <div className="bt-grid-2">
        {waterfallOption && (
          <div className="bt-card">
            <p className="bt-card__title">Woher der Erlös kommt</p>
            <p className="bt-card__sub">{waterfallNote ?? "Aufbau des Jahreserlöses."}</p>
            <ReactECharts option={waterfallOption} style={{ height: 320 }} notMerge lazyUpdate />
          </div>
        )}

        {sankeyOption && (
          <div className="bt-card">
            <p className="bt-card__title">Wohin die Energie geht</p>
            <p className="bt-card__sub">
              Jahressummen. Fahren Sie über einen Fluss, um seinen Anteil zu sehen.
            </p>
            <ReactECharts option={sankeyOption} style={{ height: 340 }} notMerge lazyUpdate />
          </div>
        )}

        <div className="bt-card" style={{ gridColumn: sankeyOption ? undefined : "1 / -1" }}>
          <p className="bt-card__title">Jahresverlauf</p>
          <p className="bt-card__sub">
            Erlösbestandteile je Monat, Linie = Gesamt. Bester Monat: {best.month_label} mit{" "}
            {formatEUR(best.total_revenue_eur)}.
          </p>
          <ReactECharts option={monthlyOption} style={{ height: 320 }} notMerge lazyUpdate />
        </div>

        {spreadOption && (
          <div className="bt-card">
            <p className="bt-card__title">Wann gekauft, wann verkauft</p>
            <p className="bt-card__sub">
              Die eingefärbte Fläche ist der Arbitrage-Spread
              {maxSpread
                ? ` — am größten im ${maxSpread.row.month_label} mit ${formatNumber(
                    maxSpread.spread,
                    0,
                  )} €/MWh.`
                : "."}
            </p>
            <ReactECharts option={spreadOption} style={{ height: 320 }} notMerge lazyUpdate />
          </div>
        )}
      </div>
    </div>
  );
}
