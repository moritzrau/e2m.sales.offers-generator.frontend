import { useMemo } from "react";
import ReactECharts from "echarts-for-react";

import type { BacktestingAnalyzeResult } from "../../../api/types";
import { formatNumber } from "../../offers/format";
import {
  aggregateSankeyFlows,
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
    const payload = result.energy_chart ?? buildEnergyChartPayloadFromMonthly(result.monthly, isGrey);
    return buildEnergyChartOption(payload);
  }, [enabled, result.energy_chart, result.monthly, isGrey]);

  const sankeyOption = useMemo(
    () => (enabled ? buildEnergySankeyOption(result.monthly, result.use_case) : null),
    [enabled, result.monthly, result.use_case],
  );

  const cyclesOption = useMemo(
    () => (enabled ? buildCyclesChartOption(result.monthly) : {}),
    [enabled, result.monthly],
  );

  const flows = useMemo(
    () => (enabled ? aggregateSankeyFlows(result.monthly, isGrey) : null),
    [enabled, result.monthly, isGrey],
  );

  if (!enabled) {
    return (
      <div className="bt-empty">
        <strong>Keine Energieauswertung</strong>
        Für Standalone-BESS gibt es keine PV-Aufteilung — die Erlösseite steht im Tab „Erlöse“.
      </div>
    );
  }

  const curtailShare =
    flows && flows.pv_gross > 0 ? (flows.curtail / flows.pv_gross) * 100 : null;

  return (
    <div>
      <section className="bt-section">
        <div className="bt-section__head">
          <h4>Wohin die Energie geht</h4>
          <p>
            Jahressummen. Fahren Sie über einen Fluss, um seinen Anteil zu sehen — beim Überfahren
            wird der zugehörige Pfad hervorgehoben.
          </p>
        </div>
        <div className="bt-card">
          {sankeyOption ? (
            <ReactECharts option={sankeyOption} style={{ height: 400 }} notMerge lazyUpdate />
          ) : (
            <p className="muted">Für diese Quelle liegen keine Energieflüsse vor.</p>
          )}
        </div>
      </section>

      <section className="bt-section">
        <div className="bt-section__head">
          <h4>Energieverwendung pro Monat</h4>
          <p>
            Der Stapel ist die Aufteilung der PV-Erzeugung (direkt, in den Speicher, abgeregelt);
            die Linien zeigen die Entladung und die Gesamteinspeisung.{" "}
            <b>PV-Einspeisung gesamt ist nicht dasselbe wie PV direkt.</b>
            {curtailShare != null && curtailShare > 0.05
              ? ` Abgeregelt wurden ${formatNumber(curtailShare, 1)} % der Erzeugung.`
              : ""}
          </p>
        </div>
        <div className="bt-card">
          <ReactECharts option={monthlyOption} style={{ height: 380 }} notMerge lazyUpdate />
        </div>
      </section>

      <section className="bt-section">
        <div className="bt-section__head">
          <h4>Ø Vollzyklen pro Tag</h4>
          <p>
            Wie stark der Speicher je Monat bewegt wird. Die gestrichelte Linie ist das
            Jahresmittel.
          </p>
        </div>
        <div className="bt-card">
          <ReactECharts option={cyclesOption} style={{ height: 300 }} notMerge lazyUpdate />
        </div>
      </section>
    </div>
  );
}
