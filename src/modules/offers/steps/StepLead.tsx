import { useState } from "react";

import { api, ApiError } from "../../../api/client";
import type { Lead } from "../../../api/types";

interface Props {
  leads: Lead[];
  selected: number | null;
  onSelect: (id: number | null) => void;
  onCreated: (lead: Lead) => void;
}

interface LeadForm {
  project_name: string;
  company_name: string;
  batt_power_mw_installed: string;
  batt_cap_mwh_installed: string;
  pv_power_installed_mw: string;
}

const EMPTY: LeadForm = {
  project_name: "",
  company_name: "",
  batt_power_mw_installed: "",
  batt_cap_mwh_installed: "",
  pv_power_installed_mw: "",
};

export function StepLead({ leads, selected, onSelect, onCreated }: Props) {
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<LeadForm>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {};
      if (form.project_name) payload.project_name = form.project_name;
      if (form.company_name) payload.company_name = form.company_name;
      const numFields = [
        "batt_power_mw_installed",
        "batt_cap_mwh_installed",
        "pv_power_installed_mw",
      ] as const;
      for (const k of numFields) {
        const v = form[k];
        if (v) payload[k] = parseFloat(v.replace(",", "."));
      }
      const created = await api.post<Lead>("/api/leads", payload);
      onCreated(created);
      setCreating(false);
      setForm(EMPTY);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="wizard-step">
      <h3>2. Lead (optional)</h3>
      <p className="muted">
        Kundendaten für PPT-Texte (Firmenname) und Anlagenkennzahlen (BESS-MW etc.). Kann leer bleiben.
      </p>

      <label className="lead-item lead-item--none">
        <input type="radio" checked={selected === null} onChange={() => onSelect(null)} />
        <span>Kein Lead — Angaben werden im nächsten Schritt manuell erfasst.</span>
      </label>

      {leads.map((lead) => {
        const d = lead.data_json as Record<string, unknown>;
        return (
          <label key={lead.id} className="lead-item">
            <input type="radio" checked={selected === lead.id} onChange={() => onSelect(lead.id)} />
            <div>
              <strong>{(d.company_name as string) || (d.project_name as string) || `Lead #${lead.id}`}</strong>
              <span className="muted">
                {(d.project_name as string) && `Projekt: ${d.project_name}`}
                {(d.batt_power_mw_installed as number) &&
                  ` · BESS: ${d.batt_power_mw_installed} MW`}
                {(d.pv_power_installed_mw as number) && ` · PV: ${d.pv_power_installed_mw} MW`}
              </span>
            </div>
          </label>
        );
      })}

      {!creating ? (
        <button className="link-btn" onClick={() => setCreating(true)} style={{ marginTop: "1rem" }}>
          + Neuen Lead anlegen
        </button>
      ) : (
        <div className="lead-form">
          <h4>Neuer Lead</h4>
          <div className="profile-form">
            <label>
              Projektname
              <input
                type="text"
                value={form.project_name}
                onChange={(e) => setForm({ ...form, project_name: e.target.value })}
              />
            </label>
            <label>
              Firmenname
              <input
                type="text"
                value={form.company_name}
                onChange={(e) => setForm({ ...form, company_name: e.target.value })}
              />
            </label>
            <label>
              BESS-Leistung (MW)
              <input
                type="text"
                inputMode="decimal"
                value={form.batt_power_mw_installed}
                onChange={(e) => setForm({ ...form, batt_power_mw_installed: e.target.value })}
              />
            </label>
            <label>
              BESS-Kapazität (MWh)
              <input
                type="text"
                inputMode="decimal"
                value={form.batt_cap_mwh_installed}
                onChange={(e) => setForm({ ...form, batt_cap_mwh_installed: e.target.value })}
              />
            </label>
            <label>
              PV-Leistung (MW)
              <input
                type="text"
                inputMode="decimal"
                value={form.pv_power_installed_mw}
                onChange={(e) => setForm({ ...form, pv_power_installed_mw: e.target.value })}
              />
            </label>
            {error && <div className="error-banner profile-form-hint">{error}</div>}
            <div className="profile-form-hint" style={{ display: "flex", gap: "0.5rem" }}>
              <button className="primary-btn primary-btn--inline" onClick={submit} disabled={submitting}>
                {submitting ? "Speichere …" : "Lead speichern"}
              </button>
              <button className="link-btn" onClick={() => setCreating(false)}>
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
