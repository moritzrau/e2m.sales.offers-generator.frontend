import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import { api, ApiError } from "../../../api/client";
import type {
  CockpitBalanceVariable,
  CockpitConfig,
  CockpitPool,
  CockpitSolveResponse,
  CockpitSolveResult,
  PrecheckOut,
} from "../../../api/types";
import { formatEUR, formatNumber } from "../format";

interface ConstantsForm {
  integrationspauschale_eur: string;
  monatlicher_betrag_eur: string;
  dl_entgelt_eur_per_mwh: string;
  vertragsmonate: string;
  mindest_projekt_eur: string;
  mindest_eur_pro_mw_monat: string;
}

const EMPTY_CONSTANTS: ConstantsForm = {
  integrationspauschale_eur: "",
  monatlicher_betrag_eur: "",
  dl_entgelt_eur_per_mwh: "",
  vertragsmonate: "",
  mindest_projekt_eur: "",
  mindest_eur_pro_mw_monat: "",
};

function parseNum(v: string): number | null {
  if (v === "") return null;
  const n = parseFloat(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

interface Props {
  backtestId: number;
  precheck: PrecheckOut;
  /**
   * Wird gesetzt, sobald das Cockpit ein gültiges Solve-Ergebnis hat.
   * Der Wizard nutzt das für die "Weiter"-Freigabe und persistiert es beim
   * nächsten Schritt (auto-save on next).
   */
  onSolveChange: (state: CockpitStepState | null) => void;
}

/** Alles, was der Wizard braucht, um beim Weiter-Klick zu speichern. */
export interface CockpitStepState {
  useCase: string;
  result: CockpitSolveResult;
}

export function StepCockpit({ backtestId, precheck, onSolveChange }: Props) {
  const useCase = precheck.use_case;
  const [constants, setConstants] = useState<ConstantsForm>(EMPTY_CONSTANTS);
  const [tvPinned, setTvPinned] = useState<number | null>(null);
  const [balanceVariable, setBalanceVariable] =
    useState<CockpitBalanceVariable>("dl_entgelt");
  const [poolOverride, setPoolOverride] = useState<{
    kunde_only_eur: string;
    pool_eur: string;
    umschlag_mwh: string;
    bezugs_mw: string;
  }>({
    kunde_only_eur: "",
    pool_eur: "",
    umschlag_mwh: "",
    bezugs_mw: "",
  });
  const [poolError, setPoolError] = useState<string | null>(null);

  const cfgQuery = useQuery<CockpitConfig>({
    queryKey: ["cockpit-config", useCase],
    queryFn: () =>
      api.get<CockpitConfig>(
        `/api/pricing/config?use_case=${encodeURIComponent(useCase)}`,
      ),
  });
  const cfg = cfgQuery.data;

  const poolMutation = useMutation<CockpitPool, ApiError, void>({
    mutationFn: async () => {
      setPoolError(null);
      // Wir kennen use_case aus precheck, brauchen aber combo/duration/sizes.
      // Für den Wizard nehmen wir dieselbe Angabe wie im Backtesting-Schritt:
      // Backend leitet den Pool aus dem hochgeladenen Backtesting ab
      // (run_analysis_from_path in /api/backtesting/analyze-upload gibt es zwar,
      // aber wir haben hier schon eine Backtest-ID). Daher rufen wir den
      // Catalog-Endpoint nur wenn eine passende Anlagenkombi existiert —
      // stattdessen leiten wir den Pool aus dem uploaded backtest direkt ab.
      // Kein Katalog-Zwang: /pricing/cockpit/from-backtest liefert das gleiche
      // Format aus einer bestehenden Backtest-Zeile.
      return api.post<CockpitPool>(
        `/api/pricing/cockpit/from-backtest/${backtestId}`,
      );
    },
    onSuccess: (data) => {
      setPoolOverride({
        kunde_only_eur: String(Math.round(data.kunde_only_eur)),
        pool_eur: String(Math.round(data.pool_eur)),
        umschlag_mwh: String(Math.round(data.umschlag_mwh)),
        bezugs_mw: String(data.bezugs_mw),
      });
    },
    onError: (err) => setPoolError(err.message),
  });

  // Beim Mount + Backtest-Wechsel: Pool automatisch ableiten.
  useEffect(() => {
    poolMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backtestId]);

  const usedInputs = useMemo(() => {
    if (!cfg) return null;
    const num = (v: string, fb: number): number => parseNum(v) ?? fb;
    return {
      use_case: useCase,
      pool_eur: parseNum(poolOverride.pool_eur) ?? 0,
      kunde_only_eur: parseNum(poolOverride.kunde_only_eur) ?? 0,
      umschlag_mwh: parseNum(poolOverride.umschlag_mwh) ?? 0,
      bezugs_mw: parseNum(poolOverride.bezugs_mw) ?? 0,
      vertragsmonate: num(constants.vertragsmonate, cfg.vertragsmonate_default),
      integrationspauschale_eur: num(
        constants.integrationspauschale_eur,
        cfg.konstanten.integrationspauschale_eur,
      ),
      monatlicher_betrag_eur: num(
        constants.monatlicher_betrag_eur,
        cfg.konstanten.monatlicher_betrag_eur,
      ),
      dl_entgelt_eur_per_mwh: num(
        constants.dl_entgelt_eur_per_mwh,
        cfg.konstanten.dl_entgelt_eur_per_mwh,
      ),
      mindest_projekt_eur: num(constants.mindest_projekt_eur, cfg.mindest.projekt_eur),
      mindest_eur_pro_mw_monat: num(
        constants.mindest_eur_pro_mw_monat,
        cfg.mindest.eur_pro_mw_monat,
      ),
      tv_pinned: tvPinned,
      balance_variable: tvPinned === null ? "tv" : balanceVariable,
    };
  }, [cfg, constants, poolOverride, tvPinned, balanceVariable, useCase]);

  const solveQuery = useQuery<CockpitSolveResponse>({
    queryKey: ["cockpit-solve", usedInputs],
    enabled: Boolean(usedInputs && cfg && (usedInputs?.pool_eur ?? 0) >= 0),
    queryFn: () =>
      api.post<CockpitSolveResponse>("/api/pricing/cockpit/solve", usedInputs),
    retry: false,
  });

  useEffect(() => {
    if (solveQuery.data) {
      onSolveChange({ useCase, result: solveQuery.data.result });
    } else {
      onSolveChange(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solveQuery.data]);

  const solve = solveQuery.data?.result.solve;

  if (cfgQuery.isLoading) return <p className="muted">Lade Cockpit-Konfiguration …</p>;
  if (cfgQuery.isError || !cfg)
    return (
      <div className="error-banner">
        Cockpit-Konfiguration nicht ladbar.
      </div>
    );

  return (
    <div>
      <p className="muted">
        Konfigurations-Version <code>{cfg.version}</code>. Konstanten und
        Mindestumsätze sind Platzhalter — Moritz ersetzt sie in Phase R-E.
      </p>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <h3>Erlös-Kategorien</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          Aus dem gewählten Backtesting abgeleitet — bei Bedarf einzeln
          überschreiben. Kunde-only geht 100 % zum Kunden, der Pool wird per
          Teilungsverhältnis geteilt, Umschlag ist die Basis fürs DL-Entgelt.
        </p>
        {poolError && <div className="error-banner">{poolError}</div>}
        <div className="profile-form">
          <label>
            Kunde-only (€/Jahr)
            <input
              type="text"
              inputMode="decimal"
              value={poolOverride.kunde_only_eur}
              onChange={(e) =>
                setPoolOverride({ ...poolOverride, kunde_only_eur: e.target.value })
              }
            />
          </label>
          <label>
            Pool (€/Jahr)
            <input
              type="text"
              inputMode="decimal"
              value={poolOverride.pool_eur}
              onChange={(e) =>
                setPoolOverride({ ...poolOverride, pool_eur: e.target.value })
              }
            />
          </label>
          <label>
            Umschlag (MWh/Jahr)
            <input
              type="text"
              inputMode="decimal"
              value={poolOverride.umschlag_mwh}
              onChange={(e) =>
                setPoolOverride({ ...poolOverride, umschlag_mwh: e.target.value })
              }
            />
          </label>
          <label>
            Bezugs-MW ({cfg.bezugs_mw_basis})
            <input
              type="text"
              inputMode="decimal"
              value={poolOverride.bezugs_mw}
              onChange={(e) =>
                setPoolOverride({ ...poolOverride, bezugs_mw: e.target.value })
              }
            />
          </label>
        </div>
      </div>

      <div className="card">
        <h3>Cockpit</h3>
        <div className="cockpit-grid">
          <ConstantCard
            label="Integrationspauschale"
            hint="einmalig (€)"
            value={constants.integrationspauschale_eur}
            solved={tvPinned !== null && balanceVariable === "integrationspauschale"}
            solvedValue={solve?.integrationspauschale_eur}
            fallback={cfg.konstanten.integrationspauschale_eur}
            onChange={(v) => setConstants({ ...constants, integrationspauschale_eur: v })}
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
                  onClick={() => setTvPinned(solve?.teilungsverhaeltnis ?? 0.5)}
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
                        setBalanceVariable(e.target.value as CockpitBalanceVariable)
                      }
                      style={{ marginLeft: "0.4rem" }}
                    >
                      <option value="dl_entgelt">DL-Entgelt</option>
                      <option value="monatlicher_betrag">monatl. Betrag</option>
                      <option value="integrationspauschale">Integrationspauschale</option>
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
            solved={tvPinned !== null && balanceVariable === "monatlicher_betrag"}
            solvedValue={solve?.monatlicher_betrag_eur}
            fallback={cfg.konstanten.monatlicher_betrag_eur}
            onChange={(v) => setConstants({ ...constants, monatlicher_betrag_eur: v })}
          />
          <ConstantCard
            label="Dienstleistungsentgelt"
            hint="€/MWh"
            value={constants.dl_entgelt_eur_per_mwh}
            solved={tvPinned !== null && balanceVariable === "dl_entgelt"}
            solvedValue={solve?.dl_entgelt_eur_per_mwh}
            fallback={cfg.konstanten.dl_entgelt_eur_per_mwh}
            onChange={(v) => setConstants({ ...constants, dl_entgelt_eur_per_mwh: v })}
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
                  setConstants({ ...constants, mindest_projekt_eur: e.target.value })
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
                  setConstants({ ...constants, mindest_eur_pro_mw_monat: e.target.value })
                }
                placeholder={String(cfg.mindest.eur_pro_mw_monat)}
              />
            </label>
          </div>
        </details>

        {solve && (
          <>
            <div className="cockpit-kpis">
              <KpiTile label="e2m-Erlös total" value={formatEUR(solve.e2m_erloes_eur)} />
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
            {solve.warnings.length > 0 && (
              <ul
                className="error-banner"
                style={{
                  background: "#fff8e6",
                  borderColor: "#f2d59b",
                  color: "#7a5b13",
                }}
              >
                {solve.warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
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
