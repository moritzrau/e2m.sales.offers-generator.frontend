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
