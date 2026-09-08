import { useEffect } from "react";

import type { BacktestingAnalyzeResult } from "../../api/types";
import { AnnahmenFooter } from "./components/AnnahmenFooter";
import { ResultHero } from "./components/ResultHero";
import type { GreenRevenueMonthly } from "./charts/revenueCharts";
import { TabEnergie } from "./tabs/TabEnergie";
import { TabErloese } from "./tabs/TabErloese";
import { TabTagesdetail } from "./tabs/TabTagesdetail";
import { TabUebersicht } from "./tabs/TabUebersicht";

export interface ResultCatalogParams {
  use_case: string;
  combo_key: string;
  duration_h: number;
  pv_mw?: number | null;
  bess_mw?: number | null;
  include_eeg?: boolean;
}

export type TabKey = "uebersicht" | "erloese" | "energie" | "tagesdetail";

const TAB_LABELS: Record<TabKey, string> = {
  uebersicht: "Übersicht",
  erloese: "Erlöse",
  energie: "Energie",
  tagesdetail: "Tagesdetail",
};

interface ResultTabsProps {
  result: BacktestingAnalyzeResult;
  catalogParams?: ResultCatalogParams;
  greenRevenue?: { monthly: GreenRevenueMonthly[] } | null;
  tab: TabKey;
  onTabChange: (tab: TabKey) => void;
}

export function ResultTabs({
  result,
  catalogParams,
  greenRevenue,
  tab,
  onTabChange,
}: ResultTabsProps) {
  const tabs: TabKey[] =
    result.use_case === "standalone_bess"
      ? ["uebersicht", "erloese", "tagesdetail"]
      : ["uebersicht", "erloese", "energie", "tagesdetail"];

  // Nach einem Wechsel des Use Case kann der aktive Tab wegfallen.
  const active = tabs.includes(tab) ? tab : "uebersicht";
  useEffect(() => {
    if (active !== tab) onTabChange(active);
  }, [active, tab, onTabChange]);

  return (
    <div>
      <ResultHero result={result} />

      {result.source?.approximation_note && (
        <p className="bt-hint" style={{ marginTop: "-0.6rem", marginBottom: "1rem" }}>
          {result.source.approximation_note}
        </p>
      )}

      {result.warnings && result.warnings.length > 0 && (
        <div className="error-banner">
          {result.warnings.map((w) => (
            <div key={w}>{w}</div>
          ))}
        </div>
      )}

      <div className="bt-tabs" role="tablist">
        {tabs.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active === key}
            className={active === key ? "is-active" : ""}
            onClick={() => onTabChange(key)}
          >
            {TAB_LABELS[key]}
          </button>
        ))}
      </div>

      {active === "uebersicht" && <TabUebersicht result={result} />}
      {active === "erloese" && <TabErloese result={result} greenRevenue={greenRevenue} />}
      {active === "energie" && <TabEnergie result={result} />}
      {active === "tagesdetail" && (
        <TabTagesdetail result={result} useCase={result.use_case} catalogParams={catalogParams} />
      )}

      <AnnahmenFooter assumptions={result.assumptions ?? []} />
    </div>
  );
}
