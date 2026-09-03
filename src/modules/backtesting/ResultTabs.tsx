import { useState } from "react";

import type { BacktestingAnalyzeResult } from "../../api/types";
import { formatEUR, formatNumber } from "../offers/format";
import { AnnahmenPopover } from "./AnnahmenPopover";
import type { GreenRevenueMonthly } from "./charts/revenueCharts";
import { TabEnergie } from "./tabs/TabEnergie";
import { TabErloese } from "./tabs/TabErloese";
import { TabTagesdetail } from "./tabs/TabTagesdetail";

export interface ResultCatalogParams {
  use_case: string;
  combo_key: string;
  duration_h: number;
  pv_mw?: number | null;
  bess_mw?: number | null;
  include_eeg?: boolean;
}

type TabKey = "erloese" | "energie" | "tagesdetail";

const TAB_LABELS: Record<TabKey, string> = {
  erloese: "Erlöse",
  energie: "Energie",
  tagesdetail: "Tagesdetail",
};

interface ResultTabsProps {
  result: BacktestingAnalyzeResult;
  catalogParams?: ResultCatalogParams;
  greenRevenue?: { monthly: GreenRevenueMonthly[] } | null;
}

function sumMonthly(
  monthly: BacktestingAnalyzeResult["monthly"],
  field: "grundverguetung" | "mehrerloese_brutto",
): number {
  return monthly.reduce((acc, m) => acc + (m[field] ?? 0), 0);
}

export function ResultTabs({ result, catalogParams, greenRevenue }: ResultTabsProps) {
  const [tab, setTab] = useState<TabKey>("erloese");
  const isGreen = result.use_case === "colocation_green";
  const isGrey = result.use_case === "colocation_grey";
  const tabs: TabKey[] =
    result.use_case === "standalone_bess"
      ? ["erloese", "tagesdetail"]
      : ["erloese", "energie", "tagesdetail"];
  const s = result.scaled_sizes;

  return (
    <div className="card" style={{ marginTop: "1rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "0.75rem",
        }}
      >
        <div>
          <h3 style={{ marginBottom: "0.25rem" }}>{result.label}</h3>
          <p className="muted" style={{ margin: 0 }}>
            {result.duration_h}h ·{" "}
            {s.pv_mw !== null && s.pv_mw > 0 ? `${formatNumber(s.pv_mw, 2)} MW PV · ` : ""}
            {formatNumber(s.bess_mw, 2)} MW / {formatNumber(s.bess_mwh, 2)} MWh BESS · Skalierung ×
            {new Intl.NumberFormat("de-DE", { maximumFractionDigits: 3 }).format(s.scale_factor)}
          </p>
          {result.source?.approximation_note && (
            <p className="profile-form-hint" style={{ margin: "0.35rem 0 0" }}>
              {result.source.approximation_note}
            </p>
          )}
        </div>
        <AnnahmenPopover assumptions={result.assumptions ?? []} />
      </div>

      {result.warnings && result.warnings.length > 0 && (
        <div className="error-banner" style={{ marginTop: "0.75rem" }}>
          {result.warnings.map((w) => (
            <div key={w}>{w}</div>
          ))}
        </div>
      )}

      <div className="kpi-grid" style={{ marginTop: "1rem" }}>
        <div className="kpi-tile">
          <span className="muted">Gesamterlös</span>
          <strong>{formatEUR(result.kpis.total_revenue_eur)}</strong>
        </div>
        {isGreen && (
          <>
            <div className="kpi-tile">
              <span className="muted">Grundvergütung</span>
              <strong>{formatEUR(sumMonthly(result.monthly, "grundverguetung"))}</strong>
            </div>
            <div className="kpi-tile">
              <span className="muted">Mehrerlöse</span>
              <strong>{formatEUR(sumMonthly(result.monthly, "mehrerloese_brutto"))}</strong>
            </div>
          </>
        )}
        {result.kpis.eeg_revenue_eur !== null && (
          <div className="kpi-tile">
            <span className="muted">EEG-Marktprämie</span>
            <strong>{formatEUR(result.kpis.eeg_revenue_eur)}</strong>
          </div>
        )}
        {isGrey && result.kpis.pv_revenue_eur !== null && (
          <div className="kpi-tile">
            <span className="muted">PV-Erlös</span>
            <strong>{formatEUR(result.kpis.pv_revenue_eur)}</strong>
          </div>
        )}
        {!isGreen && (
          <>
            <div className="kpi-tile">
              <span className="muted">FCR</span>
              <strong>{formatEUR(result.kpis.fcr_eur)}</strong>
            </div>
            <div className="kpi-tile">
              <span className="muted">aFRR (netto)</span>
              <strong>{formatEUR(result.kpis.afrr_eur)}</strong>
            </div>
            <div className="kpi-tile">
              <span className="muted">Wholesale</span>
              <strong>{formatEUR(result.kpis.wholesale_eur)}</strong>
            </div>
          </>
        )}
        {result.kpis.eur_per_mwh_storage != null && (
          <div className="kpi-tile">
            <span className="muted">€/MWh Speicher</span>
            <strong>{formatEUR(result.kpis.eur_per_mwh_storage)}</strong>
          </div>
        )}
      </div>

      <div className="wizard-stepper" style={{ marginTop: "1.25rem", marginBottom: "1rem" }}>
        {tabs.map((key) => (
          <button
            key={key}
            type="button"
            className={`wizard-stepper__item ${tab === key ? "active" : ""}`}
            onClick={() => setTab(key)}
          >
            {TAB_LABELS[key]}
          </button>
        ))}
      </div>

      {tab === "erloese" && <TabErloese result={result} greenRevenue={greenRevenue} />}
      {tab === "energie" && <TabEnergie result={result} />}
      {tab === "tagesdetail" && (
        <TabTagesdetail result={result} useCase={result.use_case} catalogParams={catalogParams} />
      )}
    </div>
  );
}
