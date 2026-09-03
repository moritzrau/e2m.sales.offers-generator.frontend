export interface Profile {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  ppt_signature: string | null;
  settings_json: Record<string, unknown>;
  default_compositions_json: Record<string, unknown>;
  created_at: string;
}

export interface Job {
  id: number;
  kind: string;
  status: "queued" | "running" | "done" | "failed";
  progress: number;
  message: string | null;
  result_json: Record<string, unknown> | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

// --- Angebotstool (Phase 3) ---

export interface Backtest {
  id: number;
  source: string;
  backtest_type: string | null;
  original_filename: string;
  file_hash: string;
  meta_json: Record<string, unknown>;
  imported_by: number | null;
  created_at: string;
}

export interface UploadResult {
  backtest: Backtest;
  duplicate: boolean;
}

export type UseCase = "colocation_green" | "colocation_grey" | "standalone_bess";

export interface OfferParams {
  dienstleistungsentgelt_eur_per_mwh?: number | null;
  anteil_mehrerloes_e2m?: number | null;
  anteil_mehrerloes_label_e2m?: number | null;
  vertragsmodell?: "DA" | "MMW" | null;
  batt_power_mw?: number | null;
  pv_power_mw?: number | null;
}

export interface PrecheckOut {
  backtest_id: number;
  backtest_type: string;
  use_case: UseCase;
  default_composition: string[];
  default_params: OfferParams;
}

export interface Block {
  id: string;
  label: string;
  category: "pflicht" | "standard" | "optional";
  description: string;
  personalized: boolean;
  may_be_missing: boolean;
  requires_plots: string[];
  requires_tokens: string[];
  requires_profile_tokens: string[];
  requires_pricing_result: string | null;
}

export interface BlocksList {
  use_case: UseCase;
  default_composition: string[];
  blocks: Block[];
}

export interface Lead {
  id: number;
  source: string;
  sf_ref: string | null;
  data_json: Record<string, unknown>;
  created_by: number | null;
  created_at: string;
}

export interface OfferSummary {
  id: number;
  profile_id: number;
  backtest_id: number;
  lead_id: number | null;
  pricing_result_id: number | null;
  status: "draft" | "queued" | "running" | "done" | "failed" | "final";
  job_id: number | null;
  released_by: number | null;
  released_at: string | null;
  sink_dir: string | null;
  created_at: string;
}

export interface OfferArtifact {
  name: string;
  kind: "pptx" | "xlsx" | "csv" | "png";
  size_bytes: number;
}

export interface OfferExportInfo {
  applied_blocks?: string[];
  skipped_blocks?: string[];
  unfilled_tokens?: string[];
}

export interface OfferDetail extends OfferSummary {
  params_json: Record<string, unknown>;
  composition_json: string[];
  output_dir: string | null;
  kpis: Record<string, number> | null;
  df_monthly: Record<string, unknown>[] | null;
  export_info: OfferExportInfo | null;
  artifacts: OfferArtifact[];
}

// --- Backtest-Roundtrip (Phase 4.3) ---

export interface Plant {
  pv_mw?: number | null;
  bess_mw?: number | null;
  bess_mwh?: number | null;
  grid_limit_mw?: number | null;
  eeg_eur_per_mwh?: number | null;
  roundtrip_efficiency?: number | null;
  max_cycles_per_day?: number | null;
}

export interface BacktestRequest {
  id: number;
  profile_id: number | null;
  lead_id: number | null;
  status: "pending" | "running" | "done" | "error";
  submitted_at: string;
  completed_at: string | null;
  result_backtest_id: number | null;
  payload_json: Record<string, unknown>;
}

// --- Backtesting-Modul Live-Analyse (Phase 6.1) ---

export interface BacktestingCatalogCombo {
  combo_key: string;
  combo_label: string;
  ref_pv_mw: number | null;
  ref_bess_mw: number;
  available_durations_h: number[];
}

export interface BacktestingCatalogUseCase {
  use_case: "colocation_green" | "colocation_grey" | "standalone_bess";
  label: string;
  combos: BacktestingCatalogCombo[];
}

export interface BacktestingScaledSizes {
  pv_mw: number | null;
  bess_mw: number;
  bess_mwh: number;
  scale_factor: number;
}

export interface BacktestingMonthlyRecord {
  month: string;
  month_label: string;
  total_revenue_eur: number;
  fcr_eur: number;
  afrr_pos_eur: number;
  afrr_neg_eur: number;
  wholesale_eur: number;
  pv_revenue_eur: number;
  eeg_revenue_eur: number;
  grundverguetung: number;
  mehrerloese_brutto: number;
  avg_daily_cycles: number;
  pv_gross_mwh?: number;
  pv_grid_mwh?: number;
  pv_direct_mwh?: number;
  pv_to_battery_mwh?: number;
  battery_to_grid_mwh?: number;
  pv_curtailment_mwh?: number;
  battery_loss_mwh?: number;
  grid_to_battery_mwh?: number;
  batt_charge_mwh?: number;
  batt_discharge_mwh?: number;
  avg_charge_price?: number;
  avg_discharge_price?: number;
}

export interface BacktestingKpis {
  total_revenue_eur: number;
  fcr_eur: number;
  afrr_eur: number;
  wholesale_eur: number;
  pv_revenue_eur: number | null;
  eeg_revenue_eur: number | null;
  eur_per_mwh_storage?: number;
  avg_daily_cycles?: number;
  pv_gross_mwh?: number;
  battery_to_grid_mwh?: number;
}

export interface ChartSeries {
  name: string;
  data: number[];
  color?: string;
  kind: "bar" | "line";
}

export interface ChartPayload {
  months: string[];
  series: ChartSeries[];
}

export interface BacktestingSourceInfo {
  origin: "standard" | "custom";
  label: string;
  preset_key?: string | null;
  combo_key?: string | null;
  duration_h?: number | null;
  backtest_id?: number | null;
  approximation_note?: string | null;
}

export interface BacktestingFeatureFlags {
  linear_scaling: boolean;
  green_split: boolean;
  pfm_grey_split: boolean;
  depth_scaling: boolean;
  energy_tab: boolean;
}

export interface BacktestingAssumptionItem {
  key: string;
  label: string;
  value: string;
}

export interface BacktestingAnalyzeResult {
  use_case: string;
  label: string;
  duration_h: number;
  scaled_sizes: BacktestingScaledSizes;
  kpis: BacktestingKpis;
  monthly: BacktestingMonthlyRecord[];
  preset_key: string;
  revenue_chart: ChartPayload;
  energy_chart?: ChartPayload | null;
  market_revenue_chart?: ChartPayload | null;
  source?: BacktestingSourceInfo;
  features?: BacktestingFeatureFlags;
  warnings?: string[];
  assumptions?: BacktestingAssumptionItem[];
}

export interface BacktestingGreenRevenueRecord {
  month: string;
  month_label: string;
  grundverguetung: number;
  mehrerloese: number;
  eeg_revenue: number;
  revenue_pv_only_eur: number;
  colocation_revenue_ex_eeg_eur: number;
  mehrwert_colocation_eur: number;
  total_revenue_eur: number;
}

export interface BacktestingGreenRevenueResponse {
  preset_key: string;
  monthly: BacktestingGreenRevenueRecord[];
}

export interface BacktestingUploadListItem {
  id: number;
  label: string;
  use_case: string | null;
  original_filename: string;
  created_at: string;
  needs_meta: boolean;
  ref_pv_mw?: number | null;
  ref_bess_mw?: number | null;
  ref_bess_mwh?: number | null;
}

export interface Preset {
  id: number;
  name: string;
  use_case: string;
  composition: string[];
  created_by: number | null;
  share_scope: "private" | "team";
  created_at: string;
}

// --- Pricing (Phase 5) ---

export interface PricingModelInfo {
  key: string;
  label: string;
  version: string;
  description: string;
}

export interface FloorKombiOption {
  value: string;
  label: string;
  backtesting_reference: string;
}

export interface FloorScenarioOption {
  value: string;
  label: string;
}

export interface FloorDefaults {
  kombis: FloorKombiOption[];
  scaling: {
    aurora: { base_year: number; scenarios: FloorScenarioOption[] };
    enervis: { base_year: number; scenarios: FloorScenarioOption[] };
  };
  defaults: {
    teilungsverhaeltnis: number;
    degradation: number;
    start_year: number;
    horizon_years: number;
    pv_mw: number;
    discount_rate: number;
  };
  ranges: {
    start_year: [number, number];
    horizon_years: [number, number];
    floor_step_eur: number;
  };
}

export interface FloorAnalyzeIn {
  kombi: string;
  scaling_name: "aurora" | "enervis";
  scenario: string;
  teilungsverhaeltnis: number;
  degradation: number;
  start_year: number;
  horizon_years: number;
  pv_mw: number;
  discount_rate: number | null;
  npv_base_year: number | null;
  floor_override: number | null;
  save: boolean;
}

export interface FloorRevenueRow {
  year: number;
  scale: number;
  degradation_factor: number;
  revenue_eur_per_mw: number;
}

export interface FloorE2mRow {
  year: number;
  revenue_eur_per_mw: number;
  customer_share_B: number;
  e2m_share: number;
  customer_payout: number;
  e2m_pv?: number;
  e2m_cumulative_npv?: number;
}

export interface FloorAnalyzeResult {
  inputs: {
    kombi: string;
    kombi_label: string;
    scaling_name: string;
    scenario: string;
    teilungsverhaeltnis: number;
    degradation: number;
    start_year: number;
    horizon_years: number;
    pv_mw: number;
    bess_mw: number;
    discount_rate: number | null;
    npv_base_year: number | null;
    floor_override: number | null;
  };
  basis: {
    basisjahr: number;
    mehrerloese_total_eur_per_mw_year: number;
    label: string;
    description: string;
    source: string;
  };
  recommended_floor_eur_per_mw: number;
  chosen_floor_eur_per_mw: number;
  summary: {
    total_e2m_eur_per_mw: number;
    total_customer_eur_per_mw: number;
    break_even_year: number | null;
    compensation_years: number[];
    negative_years: number[];
    npv_e2m_eur_per_mw: number | null;
  };
  revenue_per_year: FloorRevenueRow[];
  e2m_per_year: FloorE2mRow[];
}

export interface FloorAnalyzeResponse {
  result: FloorAnalyzeResult;
  pricing_result_id: number | null;
}

export interface PricingResultSummary {
  id: number;
  model: string;
  model_version: string;
  created_at: string;
  kombi: string | null;
  scaling_name: string | null;
  recommended_floor_eur_per_mw: number | null;
}

// --- Cockpit (Phase R-C) ---

export interface CockpitKonstanten {
  integrationspauschale_eur: number;
  monatlicher_betrag_eur: number;
  dl_entgelt_eur_per_mwh: number;
}

/** Beide Mindestumsätze beziehen sich auf die GESAMTE Vertragslaufzeit. */
export interface CockpitMindest {
  projekt_eur: number;
  eur_pro_mw_jahr: number;
}

export interface CockpitStandardBacktesting {
  combo_key: string;
  duration_h: number;
  pv_mw: number | null;
  bess_mw: number | null;
}

/** Floorpreis-Parameter; null, wenn der Use Case kein Floor-Modell hat. */
export interface CockpitFloorpreisConfig {
  scenario: string;
  start_year: number;
  /** Obergrenze der Floor-Zusage in Jahren (Vorgabe: 10). */
  max_floor_years: number;
  /** Standard-Teilungsverhältnis als Ausgangspunkt (Vorgabe: 0,84). */
  tv_standard: number;
  /** Anteil des Zuzahlungsrisikos, den e2m zusätzlich verdienen muss. */
  risikoaufschlag_lambda: number;
  /** Im Floor-Modus false: nur der Gesamt-Mindestumsatz gilt. */
  mindest_pro_mw_gilt: boolean;
  degradation: number;
  discount_rate: number;
  npv_base_year: number;
  npv_start_year: number;
  floor_step: number;
}

export interface CockpitConfig {
  version: string;
  use_case: string;
  vertragsmonate_default: number;
  bezugs_mw_basis: "pv_mw" | "bess_mw";
  konstanten: CockpitKonstanten;
  mindest: CockpitMindest;
  standard_backtesting: CockpitStandardBacktesting | null;
  floorpreis: CockpitFloorpreisConfig | null;
}

export interface CockpitPool {
  use_case: string;
  kunde_only_eur: number;
  pool_eur: number;
  umschlag_mwh: number;
  pv_mw: number | null;
  bess_mw: number;
  bess_mwh: number;
  bezugs_mw: number;
}

export type CockpitBalanceVariable =
  | "tv"
  | "dl_entgelt"
  | "monatlicher_betrag"
  | "integrationspauschale";

export interface CockpitSolveConstraints {
  projekt_ok: boolean;
  projekt_soll_eur: number;
  projekt_ist_eur: number;
  eur_pro_mw_jahr_ok: boolean;
  eur_pro_mw_jahr_soll: number;
  eur_pro_mw_jahr_ist: number;
  /** false im Floorpreis-Modus — dort gilt nur die Gesamt-Schranke. */
  eur_pro_mw_jahr_gilt: boolean;
}

/**
 * Alle ``*_eur``-Werte sind Laufzeitwerte (gesamte Vertragslaufzeit),
 * nicht Jahreswerte.
 */
export interface CockpitSolveInner {
  teilungsverhaeltnis: number;
  integrationspauschale_eur: number;
  monatlicher_betrag_eur: number;
  dl_entgelt_eur_per_mwh: number;
  balance_variable: CockpitBalanceVariable;
  e2m_erloes_eur: number;
  kunde_erloes_eur: number;
  projekt_gesamt_eur: number;
  e2m_eur_pro_mw_jahr: number;
  laufzeit_jahre: number;
  constraints: CockpitSolveConstraints;
  constraints_ok: boolean;
  warnings: string[];
}

/** Vermarktungsmodell: bisheriges Verhalten vs. Floorpreis-Zusage. */
export type CockpitVermarktungsmodell = "fully_merchant" | "floorpreis";

export interface CockpitFloorYear {
  year: number;
  scale: number;
  revenue_eur_per_mw: number;
  customer_share_B: number;
  customer_payout: number;
  e2m_share: number;
  e2m_pv: number;
  e2m_cumulative_npv: number;
}

export interface CockpitFloorSummary {
  total_e2m: number;
  total_customer: number;
  cumulative_e2m_last: number;
  break_even_year: number | null;
  compensation_years: number[];
  negative_years: number[];
  npv_e2m_total: number | null;
  discount_rate: number | null;
  npv_base_year: number | null;
}

/** Nur vorhanden, wenn mit vermarktungsmodell="floorpreis" gerechnet wurde. */
export interface CockpitFloorResult {
  /** Tatsächlich angesetzter Floor (Standard oder Slider-Wert), €/MW/a. */
  floor_eur_per_mw: number;
  /** Untergrenze des Sliders: aus tv_standard abgeleitet, kein Aufpreis. */
  floor_standard: number;
  /** Empfohlenes Slider-Ende: höchster Floor ohne negatives e2m-Jahr. */
  floor_deckel: number;
  /** Harte Grenze: darüber ist der Floor auch bei TV = 0 nicht tragbar. */
  floor_hart: number;
  /** Schrittweite des Sliders in €/MW/a. */
  floor_step: number;
  /** Zum gewählten Floor nachgerechnetes Teilungsverhältnis. */
  teilungsverhaeltnis: number;
  tv_standard: number;
  bindendes_jahr: number;
  /** Länge der Floor-Zusage = min(max_floor_years, laufzeit_jahre). */
  floor_jahre: number;
  laufzeit_jahre: number;
  /** Jahre im Fenster, in denen der Floor tatsächlich greift. */
  jahre_mit_floor: number;
  /** Zusätzlicher e2m-Erlös gegenüber dem Standard-Floor, € über die Laufzeit. */
  aufpreis_e2m_eur: number;
  /** Erwartete Zuzahlung am Standard-TV, € über das Floor-Fenster. */
  risiko_eur: number;
  risikoaufschlag_lambda: number;
  e2m_erloes_eur: number;
  e2m_standard_eur: number;
  kunde_pool_eur: number;
  pool_gesamt_eur: number;
  scenario: string;
  basis_eur_per_mw: number;
  start_year: number;
  max_floor_years: number;
  degradation: number;
  jahre: CockpitFloorYear[];
  summary: CockpitFloorSummary;
  warnings: string[];
}

export interface CockpitSolveResult {
  inputs: Record<string, unknown>;
  config_version: string;
  solver_version: string;
  /** Im Floorpreis-Modus kommt dies aus der Floor-Rechnung. */
  solve: CockpitSolveInner;
  /** Nur im Floorpreis-Modus: der Fully-Merchant-Vergleichswert. */
  solve_merchant?: CockpitSolveInner;
  floor?: CockpitFloorResult;
}

export interface CockpitSolveResponse {
  result: CockpitSolveResult;
}
