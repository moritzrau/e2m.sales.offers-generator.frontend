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
}

export interface BacktestingKpis {
  total_revenue_eur: number;
  fcr_eur: number;
  afrr_eur: number;
  wholesale_eur: number;
  pv_revenue_eur: number | null;
  eeg_revenue_eur: number | null;
}

export interface BacktestingAnalyzeResult {
  use_case: string;
  combo_label: string;
  duration_h: number;
  scaled_sizes: BacktestingScaledSizes;
  kpis: BacktestingKpis;
  monthly: BacktestingMonthlyRecord[];
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

export interface CockpitMindest {
  projekt_eur: number;
  eur_pro_mw_monat: number;
}

export interface CockpitConfig {
  version: string;
  use_case: string;
  vertragsmonate_default: number;
  bezugs_mw_basis: "pv_mw" | "bess_mw";
  konstanten: CockpitKonstanten;
  mindest: CockpitMindest;
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
  eur_pro_mw_monat_ok: boolean;
  eur_pro_mw_monat_soll: number;
  eur_pro_mw_monat_ist: number;
}

export interface CockpitSolveInner {
  teilungsverhaeltnis: number;
  integrationspauschale_eur: number;
  monatlicher_betrag_eur: number;
  dl_entgelt_eur_per_mwh: number;
  balance_variable: CockpitBalanceVariable;
  e2m_erloes_eur: number;
  kunde_erloes_eur: number;
  projekt_gesamt_eur: number;
  e2m_eur_pro_mw_monat: number;
  constraints: CockpitSolveConstraints;
  constraints_ok: boolean;
  warnings: string[];
}

export interface CockpitSolveResult {
  inputs: Record<string, unknown>;
  config_version: string;
  solver_version: string;
  solve: CockpitSolveInner;
}

export interface CockpitSolveResponse {
  result: CockpitSolveResult;
}
