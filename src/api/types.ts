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
  created_at: string;
}

export interface OfferArtifact {
  name: string;
  kind: "pptx" | "xlsx" | "csv" | "png";
  size_bytes: number;
}

export interface OfferDetail extends OfferSummary {
  params_json: Record<string, unknown>;
  composition_json: string[];
  output_dir: string | null;
  kpis: Record<string, number> | null;
  df_monthly: Record<string, unknown>[] | null;
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
