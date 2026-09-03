import { useMemo } from "react";
import ReactECharts from "echarts-for-react";

import type { BacktestingAnalyzeResult } from "../../../api/types";
import { formatNumber } from "../../offers/format";
import {
  buildCyclesChartOption,
  buildEnergyChartOption,
  buildEnergyChartPayloadFromMonthly,
  buildEnergySankeyOption,
} from "../charts/energyCharts";

interface TabEnergieProps {
  result: BacktestingAnalyzeResult;
}

function isEnergyTabEnabled(result: BacktestingAnalyzeResult): boolean {
  if (result.use_case === "standalone_bess") return false;
  if (result.features?.energy_tab === false) return false;
  return true;
}

export function TabEnergie({ result }: TabEnergieProps) {
  const enabled = isEnergyTabEnabled(result);
  const isGrey = result.use_case === "colocation_grey";

  const monthlyOption = useMemo(() => {
    if (!enabled) return {};
    const payload =
      result.energy_chart ??
      buildEnergyChartPayloadFromMonthly(result.monthly, isGrey);
    return buildEnergyChartOption(payload);
  }, [enabled, result.energy_chart, result.monthly, isGrey]);

  const sankeyOption = useMemo(() => {
    if (!enabled) return null;
    return buildEnergySankeyOption(result.monthly, result.use_case);
  }, [enabled, result.monthly, result.use_case]);

  const cyclesOption = useMemo(() => {
    if (!enabled) return {};
    return buildCyclesChartOption(result.monthly);
  }, [enabled, result.monthly]);

  if (!enabled) {
    return <div className="muted">Energieauswertung nur Colocation.</div>;
  }

  const avgCyclesKpi = result.kpis.avg_daily_cycles;

  return (
    <div className="tab-energie">
      <h4 style={{ marginTop: 0 }}>Energieverwendung pro Monat</h4>
      <p className="muted" style={{ marginTop: 0 }}>
        Gestapelte PV-Aufteilung (direkt, Speicher, Abregelung) und Einspeisung aus Batterie bzw.
        gesamt — PV-Einspeisung gesamt ist nicht identisch mit PV direkt.
      </p>
      <ReactECharts option={monthlyOption} style={{ height: 360 }} notMerge lazyUpdate />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: sankeyOption ? "1fr 1fr" : "1fr",
          gap: "1.25rem",
          marginTop: "1.25rem",
        }}
      >
        {sankeyOption && (
          <div>
            <h4 style={{ marginTop: 0 }}>Jahres-Energiefluss</h4>
            <ReactECharts option={sankeyOption} style={{ height: 320 }} notMerge lazyUpdate />
          </div>
        )}

        <div>
          <h4 style={{ marginTop: 0 }}>Ø Vollzyklen pro Tag</h4>
          {avgCyclesKpi !== undefined && (
            <p className="muted" style={{ marginTop: 0 }}>
              Jahresmittel: {formatNumber(avgCyclesKpi, 2)} Zyklen/Tag
            </p>
          )}
          <ReactECharts option={cyclesOption} style={{ height: sankeyOption ? 280 : 220 }} notMerge lazyUpdate />
        </div>
      </div>
    </div>
  );
}
