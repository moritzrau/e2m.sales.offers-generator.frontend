import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import { api, ApiError } from "../../api/client";
import type {
  BacktestingCatalogCombo,
  BacktestingCatalogUseCase,
  CockpitBalanceVariable,
  CockpitConfig,
  CockpitPool,
  CockpitSolveResponse,
} from "../../api/types";
import { formatEUR, formatNumber } from "../offers/format";

const USE_CASE_ORDER = ["colocation_green", "colocation_grey", "standalone_bess"] as const;

interface BacktestingForm {
  use_case: string;
  combo_key: string;
  duration_h: number;
  pv_mw: string;
  bess_mw: string;
  include_eeg: boolean;
}

interface ConstantsForm {
  integrationspauschale_eur: string;
  monatlicher_betrag_eur: string;
  dl_entgelt_eur_per_mwh: string;
  vertragsmonate: string;
  mindest_projekt_eur: string;
  mindest_eur_pro_mw_monat: string;
}

const EMPTY_BT: BacktestingForm = {
  use_case: "colocation_green",
  combo_key: "bess_50",
  duration_h: 2,
  pv_mw: "10",
  bess_mw: "",
  include_eeg: true,
};

function parseNum(v: string): number | null {
  if (v === "") return null;
  const n = parseFloat(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function formToConstants(c: ConstantsForm, fallback: CockpitConfig): {
  integ: number;
  monat: number;
  dl: number;
  vertragsmonate: number;
  mindest_projekt: number;
  mindest_pro_mw_monat: number;
} {
  return {
    integ:
      parseNum(c.integrationspauschale_eur) ??
      fallback.konstanten.integrationspauschale_eur,
    monat:
      parseNum(c.monatlicher_betrag_eur) ??
      fallback.konstanten.monatlicher_betrag_eur,
    dl:
      parseNum(c.dl_entgelt_eur_per_mwh) ??
      fallback.konstanten.dl_entgelt_eur_per_mwh,
    vertragsmonate: parseNum(c.vertragsmonate) ?? fallback.vertragsmonate_default,
    mindest_projekt:
      parseNum(c.mindest_projekt_eur) ?? fallback.mindest.projekt_eur,
    mindest_pro_mw_monat:
      parseNum(c.mindest_eur_pro_mw_monat) ?? fallback.mindest.eur_pro_mw_monat,
  };
}

export function PricingCockpitPage() {
  const [btForm, setBtForm] = useState<BacktestingForm>(EMPTY_BT);
  const [pool, setPool] = useState<CockpitPool | null>(null);
  const [manualPool, setManualPool] = useState<string>("");
  const [manualKunde, setManualKunde] = useState<string>("");
  const [manualUmschlag, setManualUmschlag] = useState<string>("");
  const [manualBezugsMw, setManualBezugsMw] = useState<string>("");
  const [constants, setConstants] = useState<ConstantsForm>({
    integrationspauschale_eur: "",
    monatlicher_betrag_eur: "",
    dl_entgelt_eur_per_mwh: "",
    vertragsmonate: "",
    mindest_projekt_eur: "",
    mindest_eur_pro_mw_monat: "",
  });
  const [tvPinned, setTvPinned] = useState<number | null>(null);
  const [balanceVariable, setBalanceVariable] =
    useState<CockpitBalanceVariable>("dl_entgelt");
  const [poolError, setPoolError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<number | null>(null);

  const catalog = useQuery<BacktestingCatalogUseCase[]>({
    queryKey: ["backtesting-catalog"],
    queryFn: () => api.get<BacktestingCatalogUseCase[]>("/api/backtesting/catalog"),
    retry: false,
  });

  const useCases = catalog.data ?? [];
  const currentUC = useMemo(
    () => useCases.find((u) => u.use_case === btForm.use_case) ?? useCases[0],
    [useCases, btForm.use_case],
  );
  const currentCombo: BacktestingCatalogCombo | undefined = useMemo(
    () =>
      currentUC?.combos.find((c) => c.combo_key === btForm.combo_key) ??
      currentUC?.combos[0],
    [currentUC, btForm.combo_key],
  );
  const isStandalone = currentUC?.use_case === "standalone_bess";

  const activeUseCase = pool?.use_case ?? btForm.use_case;
  const cfgQuery = useQuery<CockpitConfig>({
    queryKey: ["cockpit-config", activeUseCase],
    queryFn: () =>
      api.get<CockpitConfig>(
        `/api/pricing/config?use_case=${encodeURIComponent(activeUseCase)}`,
      ),
  });
  const cfg = cfgQuery.data;

  const fromCatalog = useMutation<CockpitPool, ApiError, void>({
    mutationFn: async () => {
      setPoolError(null);
      const payload: Record<string, unknown> = {
        use_case: btForm.use_case,
        combo_key: btForm.combo_key,
        duration_h: btForm.duration_h,
        include_eeg: btForm.include_eeg,
      };
      if (isStandalone) {
        const b = parseNum(btForm.bess_mw);
        if (b !== null) payload.bess_mw = b;
      } else {
        const p = parseNum(btForm.pv_mw);
        if (p !== null) payload.pv_mw = p;
      }
      return api.post<CockpitPool>("/api/pricing/cockpit/from-catalog", payload);
    },
    onSuccess: (data) => {
      setPool(data);
      setManualPool(String(Math.round(data.pool_eur)));
      setManualKunde(String(Math.round(data.kunde_only_eur)));
      setManualUmschlag(String(Math.round(data.umschlag_mwh)));
      setManualBezugsMw(String(data.bezugs_mw));
      setSavedId(null);
    },
    onError: (err) => setPoolError(err.message),
  });

  const usedInputs = useMemo(() => {
    if (!cfg) return null;
    const k = formToConstants(constants, cfg);
    const poolEur = parseNum(manualPool) ?? pool?.pool_eur ?? 0;
    const kunde = parseNum(manualKunde) ?? pool?.kunde_only_eur ?? 0;
    const umschlag = parseNum(manualUmschlag) ?? pool?.umschlag_mwh ?? 0;
    const bezugsMw = parseNum(manualBezugsMw) ?? pool?.bezugs_mw ?? 0;
    return {
      use_case: activeUseCase,
      pool_eur: poolEur,
      kunde_only_eur: kunde,
      umschlag_mwh: umschlag,
      bezugs_mw: bezugsMw,
      vertragsmonate: k.vertragsmonate,
      integrationspauschale_eur: k.integ,
      monatlicher_betrag_eur: k.monat,
      dl_entgelt_eur_per_mwh: k.dl,
      mindest_projekt_eur: k.mindest_projekt,
      mindest_eur_pro_mw_monat: k.mindest_pro_mw_monat,
      tv_pinned: tvPinned,
      balance_variable: tvPinned === null ? "tv" : balanceVariable,
    };
  }, [
    cfg,
    constants,
    manualPool,
    manualKunde,
    manualUmschlag,
    manualBezugsMw,
    pool,
    tvPinned,
    balanceVariable,
    activeUseCase,
  ]);

  const solveQuery = useQuery<CockpitSolveResponse>({
    queryKey: ["cockpit-solve", usedInputs],
    enabled: Boolean(usedInputs && cfg),
    queryFn: () =>
      api.post<CockpitSolveResponse>("/api/pricing/cockpit/solve", usedInputs),
    retry: false,
  });

  const save = useMutation<{ pricing_result_id: number }, ApiError, void>({
    mutationFn: async () => {
      if (!solveQuery.data) throw new ApiError(400, "Kein Ergebnis zum Speichern.");
      return api.post<{ pricing_result_id: number }>("/api/pricing/results", {
        use_case: activeUseCase,
        inputs: solveQuery.data.result.inputs,
        result: solveQuery.data.result,
      });
    },
    onSuccess: (r) => setSavedId(r.pricing_result_id),
  });

  // Beim Wechsel des Use Case die Kosten-Konstanten resetten (frisch aus Config).
  useEffect(() => {
    setConstants({
      integrationspauschale_eur: "",
      monatlicher_betrag_eur: "",
      dl_entgelt_eur_per_mwh: "",
      vertragsmonate: "",
      mindest_projekt_eur: "",
      mindest_eur_pro_mw_monat: "",
    });
    setSavedId(null);
  }, [activeUseCase]);

  const solve = solveQuery.data?.result.solve;

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Pricing-Cockpit (Preview)</h2>
          <p>
            Angebots-Gateway aus Redesign-Konzept R-C. Solver-Formel und Konstanten
            sind PLATZHALTER (siehe <code>cockpit_config.yaml</code>) und werden in
            Phase R-E durch die verbindliche Formel ersetzt. Diese Route ist
            temporär und wird in R-D in die Angebotsstrecke integriert.
          </p>
        </div>
      </div>

      <div className="card">
        <h3>1. Backtesting wählen</h3>
        {catalog.isLoading && <p className="muted">Lade Katalog …</p>}
        {catalog.isError && (
          <div className="error-banner">
            Backtesting-Katalog nicht verfügbar (BACKTESTING_DATA_DIR fehlt).
            Du kannst dennoch unten manuelle Werte eintragen.
          </div>
        )}
        {catalog.data && (
          <div className="profile-form">
            <label>
              Use Case
              <select
                value={currentUC?.use_case ?? btForm.use_case}
                onChange={(e) => {
                  const uc = e.target.value;
                  const cats = catalog.data ?? [];
                  const next = cats.find((u) => u.use_case === uc);
                  setBtForm({
                    ...btForm,
                    use_case: uc,
                    combo_key: next?.combos[0]?.combo_key ?? btForm.combo_key,
                    duration_h:
                      next?.combos[0]?.available_durations_h[0] ?? btForm.duration_h,
                  });
                  setPool(null);
                }}
              >
                {USE_CASE_ORDER.filter((uc) =>
                  useCases.some((u) => u.use_case === uc),
                ).map((uc) => (
                  <option key={uc} value={uc}>
                    {useCases.find((u) => u.use_case === uc)?.label ?? uc}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Anlagenkombination
              <select
                value={currentCombo?.combo_key ?? btForm.combo_key}
                onChange={(e) => {
                  setBtForm({ ...btForm, combo_key: e.target.value });
                }}
              >
                {currentUC?.combos.map((c) => (
                  <option key={c.combo_key} value={c.combo_key}>
                    {c.combo_label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Speicherdauer
              <select
                value={btForm.duration_h}
                onChange={(e) =>
                  setBtForm({ ...btForm, duration_h: parseInt(e.target.value, 10) })
                }
              >
                {(currentCombo?.available_durations_h ?? [2, 3, 4]).map((h) => (
                  <option key={h} value={h}>
                    {h} h
                  </option>
                ))}
              </select>
            </label>
            {isStandalone ? (
              <label>
                BESS-Leistung (MW)
                <input
                  type="text"
                  inputMode="decimal"
                  value={btForm.bess_mw}
                  onChange={(e) => setBtForm({ ...btForm, bess_mw: e.target.value })}
                  placeholder={String(currentCombo?.ref_bess_mw ?? "5")}
                />
              </label>
            ) : (
              <label>
                PV-Leistung (MW)
                <input
                  type="text"
                  inputMode="decimal"
                  value={btForm.pv_mw}
                  onChange={(e) => setBtForm({ ...btForm, pv_mw: e.target.value })}
                  placeholder={String(currentCombo?.ref_pv_mw ?? "10")}
                />
              </label>
            )}
            <div style={{ gridColumn: "1 / -1" }}>
              <button
                className="primary-btn primary-btn--inline"
                onClick={() => fromCatalog.mutate()}
                disabled={fromCatalog.isPending}
              >
                {fromCatalog.isPending
                  ? "Berechne Erlös-Kategorien …"
                  : "Erlös-Kategorien aus Backtesting ableiten"}
              </button>
              {poolError && (
                <div className="error-banner" style={{ marginTop: "0.5rem" }}>
                  {poolError}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: "1rem" }}>
        <h3>2. Aus Backtesting berechnet · manuell überschreibbar</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          Die drei Kategorien speisen den Solver: <strong>Kunde-only</strong>{" "}
          (100 % Kunde), <strong>Pool</strong> (per TV geteilt),{" "}
          <strong>Umschlag</strong> (Basis fürs DL-Entgelt).
        </p>
        <div className="profile-form">
          <label>
            Kunde-only (€/Jahr)
            <input
              type="text"
              inputMode="decimal"
              value={manualKunde}
              onChange={(e) => setManualKunde(e.target.value)}
            />
          </label>
          <label>
            Pool (€/Jahr)
            <input
              type="text"
              inputMode="decimal"
              value={manualPool}
              onChange={(e) => setManualPool(e.target.value)}
            />
          </label>
          <label>
            Umschlag (MWh/Jahr)
            <input
              type="text"
              inputMode="decimal"
              value={manualUmschlag}
              onChange={(e) => setManualUmschlag(e.target.value)}
            />
          </label>
          <label>
            Bezugs-MW ({cfg?.bezugs_mw_basis ?? "…"})
            <input
              type="text"
              inputMode="decimal"
              value={manualBezugsMw}
              onChange={(e) => setManualBezugsMw(e.target.value)}
            />
          </label>
        </div>
      </div>

      {cfg && (
        <div className="card" style={{ marginTop: "1rem" }}>
          <h3>3. Cockpit</h3>
          <p className="muted" style={{ marginTop: 0 }}>
            Konfigurations-Version: <code>{cfg.version}</code>
            {solveQuery.data && (
              <>
                {" · "}Solver: <code>{solveQuery.data.result.solver_version}</code>
              </>
            )}
          </p>

          <div className="cockpit-grid">
            <ConstantCard
              label="Integrationspauschale"
              hint="einmalig (€)"
              value={constants.integrationspauschale_eur}
              solved={
                tvPinned !== null && balanceVariable === "integrationspauschale"
              }
              solvedValue={solve?.integrationspauschale_eur}
              fallback={cfg.konstanten.integrationspauschale_eur}
              onChange={(v) =>
                setConstants({ ...constants, integrationspauschale_eur: v })
              }
            />
            <div className="cockpit-tv">
              <div className="cockpit-tv__label">Teilungsverhältnis</div>
              <div className="cockpit-tv__value">
                {solve ? `${(solve.teilungsverhaeltnis * 100).toFixed(1)} %` : "—"}
              </div>
              <div className="cockpit-tv__hint">
                {tvPinned === null
                  ? "Solver-Ausgabe (nicht gepinnt)"
                  : `gepinnt bei ${(tvPinned * 100).toFixed(1)} %`}
              </div>
              <div className="cockpit-tv__controls">
                {tvPinned === null ? (
                  <button
                    className="link-btn"
                    onClick={() =>
                      setTvPinned(solve?.teilungsverhaeltnis ?? 0.5)
                    }
                  >
                    TV pinnen
                  </button>
                ) : (
                  <>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.005}
                      value={tvPinned}
                      onChange={(e) => setTvPinned(parseFloat(e.target.value))}
                      style={{ width: "100%" }}
                    />
                    <label style={{ display: "block", fontSize: "0.85rem" }}>
                      Ausgleich über
                      <select
                        value={balanceVariable}
                        onChange={(e) =>
                          setBalanceVariable(
                            e.target.value as CockpitBalanceVariable,
                          )
                        }
                        style={{ marginLeft: "0.4rem" }}
                      >
                        <option value="dl_entgelt">DL-Entgelt</option>
                        <option value="monatlicher_betrag">monatl. Betrag</option>
                        <option value="integrationspauschale">
                          Integrationspauschale
                        </option>
                      </select>
                    </label>
                    <button className="link-btn" onClick={() => setTvPinned(null)}>
                      Pin lösen
                    </button>
                  </>
                )}
              </div>
            </div>
            <ConstantCard
              label="Monatlicher Betrag"
              hint="€/Monat"
              value={constants.monatlicher_betrag_eur}
              solved={
                tvPinned !== null && balanceVariable === "monatlicher_betrag"
              }
              solvedValue={solve?.monatlicher_betrag_eur}
              fallback={cfg.konstanten.monatlicher_betrag_eur}
              onChange={(v) =>
                setConstants({ ...constants, monatlicher_betrag_eur: v })
              }
            />
            <ConstantCard
              label="Dienstleistungsentgelt"
              hint="€/MWh"
              value={constants.dl_entgelt_eur_per_mwh}
              solved={tvPinned !== null && balanceVariable === "dl_entgelt"}
              solvedValue={solve?.dl_entgelt_eur_per_mwh}
              fallback={cfg.konstanten.dl_entgelt_eur_per_mwh}
              onChange={(v) =>
                setConstants({ ...constants, dl_entgelt_eur_per_mwh: v })
              }
            />
            <div />
            <div />
          </div>

          <details style={{ marginTop: "1rem" }}>
            <summary>Leitplanken + Vertragslaufzeit anpassen</summary>
            <div className="profile-form" style={{ marginTop: "0.75rem" }}>
              <label>
                Vertragsmonate
                <input
                  type="text"
                  inputMode="numeric"
                  value={constants.vertragsmonate}
                  onChange={(e) =>
                    setConstants({ ...constants, vertragsmonate: e.target.value })
                  }
                  placeholder={String(cfg.vertragsmonate_default)}
                />
              </label>
              <label>
                Mindestumsatz Projekt (€)
                <input
                  type="text"
                  inputMode="decimal"
                  value={constants.mindest_projekt_eur}
                  onChange={(e) =>
                    setConstants({
                      ...constants,
                      mindest_projekt_eur: e.target.value,
                    })
                  }
                  placeholder={String(cfg.mindest.projekt_eur)}
                />
              </label>
              <label>
                Mindestumsatz €/MW/Monat
                <input
                  type="text"
                  inputMode="decimal"
                  value={constants.mindest_eur_pro_mw_monat}
                  onChange={(e) =>
                    setConstants({
                      ...constants,
                      mindest_eur_pro_mw_monat: e.target.value,
                    })
                  }
                  placeholder={String(cfg.mindest.eur_pro_mw_monat)}
                />
              </label>
            </div>
          </details>

          {solve && (
            <div className="cockpit-kpis">
              <KpiTile
                label="e2m-Erlös total"
                value={formatEUR(solve.e2m_erloes_eur)}
              />
              <KpiTile
                label="Kunde-Erlös total"
                value={formatEUR(solve.kunde_erloes_eur)}
              />
              <KpiTile
                label="Projekt gesamt"
                value={formatEUR(solve.projekt_gesamt_eur)}
              />
              <KpiTile
                label="e2m €/MW/Monat"
                value={`${formatNumber(solve.e2m_eur_pro_mw_monat)} €`}
              />
            </div>
          )}

          {solve && (
            <div className="cockpit-checks">
              <ConstraintPill
                ok={solve.constraints.projekt_ok}
                label="Projekt-Mindestumsatz"
                actual={solve.constraints.projekt_ist_eur}
                target={solve.constraints.projekt_soll_eur}
                unit="€"
              />
              <ConstraintPill
                ok={solve.constraints.eur_pro_mw_monat_ok}
                label="Mindestumsatz je MW/Monat"
                actual={solve.constraints.eur_pro_mw_monat_ist}
                target={solve.constraints.eur_pro_mw_monat_soll}
                unit="€/MW/Monat"
              />
            </div>
          )}

          {solve && solve.warnings.length > 0 && (
            <ul
              className="error-banner"
              style={{ background: "#fff8e6", borderColor: "#f2d59b", color: "#7a5b13" }}
            >
              {solve.warnings.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
          )}

          <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem" }}>
            <button
              className="primary-btn primary-btn--inline"
              onClick={() => save.mutate()}
              disabled={!solve || save.isPending}
            >
              {save.isPending ? "Speichere …" : "Ergebnis speichern"}
            </button>
            {savedId !== null && (
              <span className="muted" style={{ alignSelf: "center" }}>
                Gespeichert als <code>pricing_result_id={savedId}</code>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface ConstantCardProps {
  label: string;
  hint: string;
  value: string;
  solved: boolean;
  solvedValue: number | undefined;
  fallback: number;
  onChange: (v: string) => void;
}

function ConstantCard({
  label,
  hint,
  value,
  solved,
  solvedValue,
  fallback,
  onChange,
}: ConstantCardProps) {
  return (
    <div className={`cockpit-card ${solved ? "cockpit-card--solved" : ""}`}>
      <div className="cockpit-card__label">{label}</div>
      <div className="cockpit-card__hint">{hint}</div>
      {solved ? (
        <div className="cockpit-card__value">
          {solvedValue !== undefined ? formatNumber(solvedValue) : "—"}
          <span className="cockpit-card__solved-tag">gesolved</span>
        </div>
      ) : (
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={String(fallback)}
        />
      )}
    </div>
  );
}

function KpiTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="cockpit-kpi">
      <div className="cockpit-kpi__label">{label}</div>
      <div className="cockpit-kpi__value">{value}</div>
    </div>
  );
}

interface ConstraintPillProps {
  ok: boolean;
  label: string;
  actual: number;
  target: number;
  unit: string;
}

function ConstraintPill({ ok, label, actual, target, unit }: ConstraintPillProps) {
  return (
    <div className={`cockpit-check ${ok ? "cockpit-check--ok" : "cockpit-check--bad"}`}>
      <div className="cockpit-check__label">{label}</div>
      <div className="cockpit-check__value">
        {formatNumber(actual)} {unit}
      </div>
      <div className="cockpit-check__target">
        Mindest: {formatNumber(target)} {unit}
      </div>
    </div>
  );
}
