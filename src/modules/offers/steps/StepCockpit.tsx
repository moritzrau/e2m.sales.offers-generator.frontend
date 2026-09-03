import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import ReactECharts from "echarts-for-react";

import { api, ApiError } from "../../../api/client";
import type {
  CockpitBalanceVariable,
  CockpitConfig,
  CockpitFloorResult,
  CockpitPool,
  CockpitSolveInner,
  CockpitSolveResponse,
  CockpitSolveResult,
  CockpitVermarktungsmodell,
  PrecheckOut,
} from "../../../api/types";
import { formatEUR, formatNumber, formatPercent } from "../format";

interface ConstantsForm {
  integrationspauschale_eur: string;
  monatlicher_betrag_eur: string;
  dl_entgelt_eur_per_mwh: string;
  vertragsmonate: string;
  mindest_projekt_eur: string;
  mindest_eur_pro_mw_jahr: string;
}

const EMPTY_CONSTANTS: ConstantsForm = {
  integrationspauschale_eur: "",
  monatlicher_betrag_eur: "",
  dl_entgelt_eur_per_mwh: "",
  vertragsmonate: "",
  mindest_projekt_eur: "",
  mindest_eur_pro_mw_jahr: "",
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
  const [vermarktungsmodell, setVermarktungsmodell] =
    useState<CockpitVermarktungsmodell>("fully_merchant");
  const [constants, setConstants] = useState<ConstantsForm>(EMPTY_CONSTANTS);
  const [tvPinned, setTvPinned] = useState<number | null>(null);
  const [balanceVariable, setBalanceVariable] =
    useState<CockpitBalanceVariable>("dl_entgelt");
  /** Slider im Floorpreis-Modus; null = Standard-Floor aus dem Backend. */
  const [floorWish, setFloorWish] = useState<number | null>(null);
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
      // Kein Katalog-Zwang: /pricing/cockpit/from-backtest leitet den Pool aus
      // der bestehenden Backtest-Zeile ab (auch für hochgeladene Backtestings).
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

  const isFloor = vermarktungsmodell === "floorpreis";

  const usedInputs = useMemo(() => {
    if (!cfg) return null;
    const num = (v: string, fb: number): number => parseNum(v) ?? fb;
    return {
      use_case: useCase,
      vermarktungsmodell,
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
      mindest_eur_pro_mw_jahr: num(
        constants.mindest_eur_pro_mw_jahr,
        cfg.mindest.eur_pro_mw_jahr,
      ),
      // Im Floorpreis-Modus rechnet sich das TV aus dem Floor — nicht pinnbar.
      tv_pinned: isFloor ? null : tvPinned,
      balance_variable: !isFloor && tvPinned !== null ? balanceVariable : "tv",
      floor_gewuenscht_eur_per_mw: isFloor ? floorWish : null,
    };
  }, [
    cfg,
    constants,
    poolOverride,
    tvPinned,
    balanceVariable,
    useCase,
    vermarktungsmodell,
    isFloor,
    floorWish,
  ]);

  const solveQuery = useQuery<CockpitSolveResponse>({
    queryKey: ["cockpit-solve", usedInputs],
    enabled: Boolean(usedInputs && cfg && (usedInputs?.pool_eur ?? 0) >= 0),
    queryFn: () =>
      api.post<CockpitSolveResponse>("/api/pricing/cockpit/solve", usedInputs),
    retry: false,
    placeholderData: (prev) => prev,
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
  const solveMerchant = solveQuery.data?.result.solve_merchant;
  const floor = solveQuery.data?.result.floor;
  const floorAvailable = Boolean(cfg?.floorpreis);

  // Wechselt der Use Case auf einen ohne Floor-Modell, zurück auf Fully Merchant.
  useEffect(() => {
    if (!floorAvailable && isFloor) {
      setVermarktungsmodell("fully_merchant");
      setFloorWish(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floorAvailable]);

  // Ändert sich die Datenbasis, verschieben sich die Slider-Grenzen — einen
  // Wunsch-Floor außerhalb des neuen Bereichs auf die Grenze ziehen.
  useEffect(() => {
    if (floorWish === null || !floor) return;
    const clamped = Math.min(Math.max(floorWish, floor.floor_standard), floor.floor_hart);
    if (clamped !== floorWish) setFloorWish(clamped);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floor?.floor_standard, floor?.floor_hart]);

  if (cfgQuery.isLoading) return <p className="muted">Lade Cockpit-Konfiguration …</p>;
  if (cfgQuery.isError || !cfg)
    return <div className="error-banner">Cockpit-Konfiguration nicht ladbar.</div>;

  const solveError = solveQuery.isError ? (solveQuery.error as ApiError).message : null;

  return (
    <div>
      <div className="cockpit-modelle" style={{ marginBottom: "1rem" }}>
        <ModellButton
          active={!isFloor}
          label="Fully Merchant"
          hint="Kunde erhält seinen Anteil am Mehrerlös — keine Garantie."
          onClick={() => {
            setVermarktungsmodell("fully_merchant");
            setFloorWish(null);
          }}
        />
        <ModellButton
          active={isFloor}
          label="Floorpreis"
          hint={
            floorAvailable
              ? `Garantierter Mindesterlös für ${
                  cfg.floorpreis ? cfg.floorpreis.max_floor_years : 10
                } Jahre.`
              : "Nur für grüne Colocation hinterlegt."
          }
          disabled={!floorAvailable}
          onClick={() => {
            setVermarktungsmodell("floorpreis");
            setTvPinned(null);
          }}
        />
      </div>

      {solveError && <div className="error-banner">{solveError}</div>}

      {isFloor ? (
        <FloorResultPanel
          solve={solve}
          floor={floor}
          merchantTv={solveMerchant?.teilungsverhaeltnis}
          floorWish={floorWish}
          onFloorWish={setFloorWish}
          loading={solveQuery.isFetching}
        />
      ) : (
        <MerchantResultPanel
          solve={solve}
          poolEur={parseNum(poolOverride.pool_eur) ?? 0}
          loading={solveQuery.isFetching}
        />
      )}

      <div className="card" style={{ marginTop: "1rem" }}>
        <div className="cockpit-panel__head">
          <h3 style={{ margin: 0 }}>Stellschrauben</h3>
          <span className="muted">
            Vertragslaufzeit{" "}
            {solve ? `${formatNumber(solve.laufzeit_jahre, 1)} Jahre` : "—"}
          </span>
        </div>

        <div className="cockpit-schrauben">
          <ConstantCard
            label="Integrationspauschale"
            hint="einmalig, €"
            value={constants.integrationspauschale_eur}
            solved={!isFloor && tvPinned !== null && balanceVariable === "integrationspauschale"}
            solvedValue={solve?.integrationspauschale_eur}
            fallback={cfg.konstanten.integrationspauschale_eur}
            onChange={(v) => setConstants({ ...constants, integrationspauschale_eur: v })}
          />
          <ConstantCard
            label="Monatlicher Betrag"
            hint="€ pro Monat"
            value={constants.monatlicher_betrag_eur}
            solved={!isFloor && tvPinned !== null && balanceVariable === "monatlicher_betrag"}
            solvedValue={solve?.monatlicher_betrag_eur}
            fallback={cfg.konstanten.monatlicher_betrag_eur}
            onChange={(v) => setConstants({ ...constants, monatlicher_betrag_eur: v })}
          />
          <ConstantCard
            label="Dienstleistungsentgelt"
            hint={`€/MWh auf ${formatNumber(parseNum(poolOverride.umschlag_mwh) ?? 0, 0)} MWh/Jahr`}
            value={constants.dl_entgelt_eur_per_mwh}
            solved={!isFloor && tvPinned !== null && balanceVariable === "dl_entgelt"}
            solvedValue={solve?.dl_entgelt_eur_per_mwh}
            fallback={cfg.konstanten.dl_entgelt_eur_per_mwh}
            onChange={(v) => setConstants({ ...constants, dl_entgelt_eur_per_mwh: v })}
          />
          <label className="cockpit-field">
            <span className="cockpit-field__label">Vertragslaufzeit</span>
            <span className="cockpit-field__hint">Monate</span>
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
        </div>

        {isFloor ? (
          <p className="cockpit-hinweis">
            Das Teilungsverhältnis rechnet sich aus dem gewählten Floorpreis — im
            Floorpreis-Modus nicht direkt setzbar.
          </p>
        ) : (
          <div className="cockpit-tv-controls">
            <label className="cockpit-radio">
              <input
                type="radio"
                checked={tvPinned === null}
                onChange={() => setTvPinned(null)}
              />
              <span>
                <strong>Teilungsverhältnis automatisch</strong>
                <span className="muted">
                  {" "}
                  — höchstes TV, bei dem die Leitplanken halten
                </span>
              </span>
            </label>
            <label className="cockpit-radio">
              <input
                type="radio"
                checked={tvPinned !== null}
                onChange={() => setTvPinned(solve?.teilungsverhaeltnis ?? 0.5)}
              />
              <span>
                <strong>Teilungsverhältnis festsetzen</strong>
              </span>
            </label>
            {tvPinned !== null && (
              <div className="cockpit-tv-pin">
                <span className="cockpit-tv-pin__value">{formatPercent(tvPinned)}</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.005}
                  value={tvPinned}
                  onChange={(e) => setTvPinned(parseFloat(e.target.value))}
                />
                <label className="cockpit-tv-pin__select">
                  Ausgleich über
                  <select
                    value={balanceVariable}
                    onChange={(e) =>
                      setBalanceVariable(e.target.value as CockpitBalanceVariable)
                    }
                  >
                    <option value="dl_entgelt">DL-Entgelt</option>
                    <option value="monatlicher_betrag">monatl. Betrag</option>
                    <option value="integrationspauschale">Integrationspauschale</option>
                  </select>
                </label>
              </div>
            )}
          </div>
        )}
      </div>

      {isFloor && <FloorVerlaufPanel floor={floor} />}

      <details className="card cockpit-details" style={{ marginTop: "1rem" }}>
        <summary>
          Datenbasis aus dem Backtesting
          <span className="muted">
            {" "}
            — Pool {formatEUR(parseNum(poolOverride.pool_eur) ?? 0)}/Jahr · Kunde-only{" "}
            {formatEUR(parseNum(poolOverride.kunde_only_eur) ?? 0)}/Jahr ·{" "}
            {formatNumber(parseNum(poolOverride.umschlag_mwh) ?? 0, 0)} MWh/Jahr ·{" "}
            {formatNumber(parseNum(poolOverride.bezugs_mw) ?? 0, 2)} MW
          </span>
        </summary>
        <p className="muted" style={{ marginTop: "0.5rem" }}>
          Aus dem gewählten Backtesting abgeleitet — bei Bedarf einzeln
          überschreiben. Kunde-only geht zu 100 % zum Kunden, der Pool wird per
          Teilungsverhältnis geteilt, der Umschlag ist die Basis fürs DL-Entgelt.
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
            Mehrerlös-Pool (€/Jahr)
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
            Bezugsleistung in MW ({cfg.bezugs_mw_basis})
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
      </details>

      <details className="card cockpit-details" style={{ marginTop: "0.75rem" }}>
        <summary>
          Leitplanken
          <span className="muted">
            {" "}
            — {formatNumber(cfg.mindest.projekt_eur, 0)} € über die Laufzeit
            {isFloor
              ? " (im Floorpreis-Modus gilt nur diese)"
              : ` · ${formatNumber(cfg.mindest.eur_pro_mw_jahr, 0)} € je MW und Jahr`}
          </span>
        </summary>
        <div className="profile-form" style={{ marginTop: "0.5rem" }}>
          <label>
            Mindestumsatz Projekt (€ gesamte Laufzeit)
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
            Mindestumsatz je MW und Jahr (€)
            <input
              type="text"
              inputMode="decimal"
              value={constants.mindest_eur_pro_mw_jahr}
              onChange={(e) =>
                setConstants({ ...constants, mindest_eur_pro_mw_jahr: e.target.value })
              }
              placeholder={String(cfg.mindest.eur_pro_mw_jahr)}
              disabled={isFloor}
            />
          </label>
        </div>
        {isFloor && (
          <p className="muted" style={{ marginTop: 0 }}>
            Im Floorpreis-Modus gilt nur der Gesamt-Mindestumsatz über die
            Vertragslaufzeit — die Schranke je MW und Jahr ist ausgesetzt.
          </p>
        )}
      </details>

      <p className="cockpit-foot muted">
        Konfiguration <code>{cfg.version}</code>, Rechenkern{" "}
        <code>{solveQuery.data?.result.solver_version ?? "—"}</code>. Konstanten und
        Leitplanken sind noch Platzhalter.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Ergebnis-Panels                                                     */
/* ------------------------------------------------------------------ */

function MerchantResultPanel({
  solve,
  poolEur,
  loading,
}: {
  solve: CockpitSolveInner | undefined;
  poolEur: number;
  loading: boolean;
}) {
  if (!solve) {
    return (
      <div className="card cockpit-result">
        <p className="muted" style={{ margin: 0 }}>
          {loading ? "Rechne …" : "Noch kein Ergebnis."}
        </p>
      </div>
    );
  }

  const tv = solve.teilungsverhaeltnis;
  const kundeJahr = poolEur * tv;
  const e2mJahr = poolEur * (1 - tv);

  return (
    <div className="card cockpit-result">
      <div className="cockpit-panel__head">
        <span className="cockpit-result__eyebrow">Ergebnis</span>
        <StatusChip ok={solve.constraints_ok} />
      </div>

      <div className="cockpit-headline">
        <span className="cockpit-headline__label">Teilungsverhältnis</span>
        <span className="cockpit-headline__value">{formatPercent(tv)}</span>
      </div>
      <p className="cockpit-headline__sub">
        Kunde erhält <strong>{formatEUR(kundeJahr)}</strong> pro Jahr · e2m{" "}
        <strong>{formatEUR(e2mJahr)}</strong> pro Jahr — Anteile am Mehrerlös-Pool
        von {formatEUR(poolEur)} pro Jahr.
      </p>

      <div className="cockpit-kpis">
        <KpiTile
          label={`e2m-Erlös über ${formatNumber(solve.laufzeit_jahre, 1)} Jahre`}
          value={formatEUR(solve.e2m_erloes_eur)}
          hint={`Mindestumsatz ${formatEUR(solve.constraints.projekt_soll_eur)}`}
          tone={solve.constraints.projekt_ok ? "ok" : "bad"}
        />
        <KpiTile
          label="e2m je MW und Jahr"
          value={`${formatNumber(solve.e2m_eur_pro_mw_jahr, 0)} €`}
          hint={
            solve.constraints.eur_pro_mw_jahr_gilt
              ? `Mindestumsatz ${formatNumber(solve.constraints.eur_pro_mw_jahr_soll, 0)} €`
              : "Schranke im Floorpreis-Modus ausgesetzt"
          }
          tone={
            !solve.constraints.eur_pro_mw_jahr_gilt
              ? "muted"
              : solve.constraints.eur_pro_mw_jahr_ok
                ? "ok"
                : "bad"
          }
        />
        <KpiTile
          label="Projektvolumen über die Laufzeit"
          value={formatEUR(solve.projekt_gesamt_eur)}
          hint={`davon Kunde ${formatEUR(solve.kunde_erloes_eur)}`}
        />
      </div>

      {solve.warnings.length > 0 && <WarnList items={solve.warnings} />}
    </div>
  );
}

function FloorResultPanel({
  solve,
  floor,
  merchantTv,
  floorWish,
  onFloorWish,
  loading,
}: {
  solve: CockpitSolveInner | undefined;
  floor: CockpitFloorResult | undefined;
  merchantTv: number | undefined;
  floorWish: number | null;
  onFloorWish: (v: number | null) => void;
  loading: boolean;
}) {
  if (!solve || !floor) {
    return (
      <div className="card cockpit-result">
        <p className="muted" style={{ margin: 0 }}>
          {loading ? "Rechne Floorpreis …" : "Noch kein Ergebnis."}
        </p>
      </div>
    );
  }

  const sliderValue = floorWish ?? floor.floor_standard;
  const sliderMax = Math.max(floor.floor_hart, floor.floor_standard);
  const sliderDisabled = sliderMax <= floor.floor_standard;
  const tvDelta = floor.teilungsverhaeltnis - floor.tv_standard;
  const ersterFloorJahr = floor.jahre.find(
    (row) => row.customer_payout > row.customer_share_B + 0.01,
  )?.year;

  return (
    <div className="card cockpit-result">
      <div className="cockpit-panel__head">
        <span className="cockpit-result__eyebrow">Ergebnis</span>
        <StatusChip ok={solve.constraints_ok} />
      </div>

      <div className="cockpit-headline">
        <span className="cockpit-headline__label">Garantierter Floorpreis</span>
        <span className="cockpit-headline__value">
          {formatNumber(floor.floor_eur_per_mw, 0)} €
          <span className="cockpit-headline__unit"> je MW und Jahr</span>
        </span>
      </div>
      <p className="cockpit-headline__sub">
        Zusage über <strong>{floor.floor_jahre} Jahre</strong> ab {floor.start_year} ·
        Teilungsverhältnis <strong>{formatPercent(floor.teilungsverhaeltnis)}</strong>{" "}
        (Standard {formatPercent(floor.tv_standard)}
        {Math.abs(tvDelta) >= 0.0005
          ? `, ${tvDelta > 0 ? "+" : "−"}${formatNumber(Math.abs(tvDelta) * 100, 1)} Prozentpunkte`
          : ""}
        )
        {merchantTv !== undefined && (
          <> · Fully Merchant käme auf {formatPercent(merchantTv)}</>
        )}
      </p>

      <div className="cockpit-slider">
        <div className="cockpit-slider__head">
          <span className="cockpit-slider__label">Floorpreis wählen</span>
          <span className="cockpit-slider__value">
            {formatNumber(sliderValue, 0)} € je MW und Jahr
          </span>
        </div>
        <input
          type="range"
          min={floor.floor_standard}
          max={sliderMax}
          step={floor.floor_step}
          value={sliderValue}
          disabled={sliderDisabled}
          onChange={(e) => onFloorWish(parseFloat(e.target.value))}
        />
        <div className="cockpit-slider__scale">
          <span>
            Standard {formatNumber(floor.floor_standard, 0)} €
            <span className="muted"> (ohne Aufpreis)</span>
          </span>
          <span>
            Deckel {formatNumber(floor.floor_deckel, 0)} €
            {sliderMax > floor.floor_deckel && (
              <span className="muted"> · Grenze {formatNumber(sliderMax, 0)} €</span>
            )}
          </span>
        </div>
        {sliderDisabled && (
          <p className="muted" style={{ margin: "0.25rem 0 0" }}>
            Über dem Standard-Floor ist mit dieser Datenbasis kein höherer Floor
            tragbar.
          </p>
        )}
        {floorWish !== null && (
          <button className="link-btn" onClick={() => onFloorWish(null)}>
            Zurück auf Standard
          </button>
        )}
      </div>

      <div className="cockpit-badges">
        <span className="cockpit-badge">
          Aufpreis für e2m{" "}
          <strong>
            {floor.aufpreis_e2m_eur > 0 ? "+" : ""}
            {formatEUR(floor.aufpreis_e2m_eur)}
          </strong>
        </span>
        <span className="cockpit-badge">
          Zuzahlungsrisiko <strong>{formatEUR(floor.risiko_eur)}</strong>
          <span className="muted">
            {" "}
            · {formatPercent(floor.risikoaufschlag_lambda)} davon muss e2m
            zusätzlich verdienen
          </span>
        </span>
      </div>

      <div className="cockpit-kpis">
        <KpiTile
          label={`e2m-Erlös über ${formatNumber(solve.laufzeit_jahre, 1)} Jahre`}
          value={formatEUR(solve.e2m_erloes_eur)}
          hint={`Mindestumsatz ${formatEUR(solve.constraints.projekt_soll_eur)} · Standard ${formatEUR(floor.e2m_standard_eur)}`}
          tone={solve.constraints.projekt_ok ? "ok" : "bad"}
        />
        <KpiTile
          label="Floor greift"
          value={`${floor.jahre_mit_floor} von ${floor.floor_jahre} Jahren`}
          hint={
            ersterFloorJahr !== undefined
              ? `erstmals ${ersterFloorJahr} — e2m zahlt dann zu`
              : "e2m zahlt in keinem Jahr zu"
          }
          tone={floor.jahre_mit_floor > 0 ? "warn" : "ok"}
        />
        <KpiTile
          label="NPV des e2m-Anteils"
          value={formatEUR(floor.summary.npv_e2m_total)}
          hint={
            floor.summary.discount_rate !== null
              ? `${formatPercent(floor.summary.discount_rate)} auf ${floor.summary.npv_base_year}`
              : "ohne Diskontierung"
          }
        />
      </div>

      {solve.warnings.length > 0 && <WarnList items={solve.warnings} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Jahresverlauf (Chart + Tabelle)                                     */
/* ------------------------------------------------------------------ */

function FloorVerlaufPanel({ floor }: { floor: CockpitFloorResult | undefined }) {
  if (!floor || floor.jahre.length === 0) return null;

  const years = floor.jahre.map((r) => r.year);
  const kunde = floor.jahre.map((r) => Math.round(r.customer_payout));
  const e2m = floor.jahre.map((r) => Math.round(r.e2m_share));
  const de = new Intl.NumberFormat("de-DE");

  const option = {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    legend: { data: ["Kundenanteil", "e2m-Anteil"] },
    grid: { left: 60, right: 20, top: 40, bottom: 30 },
    xAxis: { type: "category", data: years },
    yAxis: {
      type: "value",
      name: "€/MW",
      axisLabel: { formatter: (v: number) => de.format(v) },
    },
    series: [
      {
        name: "Kundenanteil",
        type: "bar",
        stack: "aufteilung",
        data: kunde,
        itemStyle: { color: "#001a70" },
      },
      {
        name: "e2m-Anteil",
        type: "bar",
        stack: "aufteilung",
        data: e2m,
        itemStyle: { color: "#fe5716" },
        markLine: {
          symbol: "none",
          silent: true,
          lineStyle: { color: "#0f1c3f", type: "dashed" },
          label: {
            formatter: `Floor ${de.format(floor.floor_eur_per_mw)}`,
            position: "insideEndTop",
          },
          data: [{ yAxis: floor.floor_eur_per_mw }],
        },
      },
    ],
  };

  const letztesJahr = floor.jahre[floor.jahre.length - 1];

  return (
    <div className="card" style={{ marginTop: "1rem" }}>
      <div className="cockpit-panel__head">
        <h3 style={{ margin: 0 }}>Jahresverlauf</h3>
        <span className="muted">
          {years[0]}–{years[years.length - 1]} · {floor.floor_jahre} Jahre Floor-Zusage
          · Aurora Central (gemittelt Nov 25 / Juni 26)
        </span>
      </div>

      <ReactECharts option={option} style={{ height: 300 }} notMerge />

      <p className="muted" style={{ marginTop: "0.25rem" }}>
        Balken zusammen = Mehrerlös pro MW. Wird der e2m-Anteil negativ, zahlt e2m
        aus dem eigenen Anteil zu, um den Floor zu halten
        {floor.jahre_mit_floor > 0
          ? ` — insgesamt ${formatEUR(floor.risiko_eur)} über die Zusage.`
          : "."}
      </p>

      {floor.warnings.length > 0 && <WarnList items={floor.warnings} />}

      <details style={{ marginTop: "0.5rem" }}>
        <summary className="muted">Als Tabelle anzeigen</summary>
        <table className="offers-table" style={{ marginTop: "0.5rem" }}>
          <thead>
            <tr>
              <th>Jahr</th>
              <th style={{ textAlign: "right" }}>Aurora-Faktor</th>
              <th style={{ textAlign: "right" }}>Mehrerlös €/MW</th>
              <th style={{ textAlign: "right" }}>Kunde €/MW</th>
              <th style={{ textAlign: "right" }}>e2m €/MW</th>
              <th style={{ textAlign: "right" }}>e2m NPV kumuliert</th>
            </tr>
          </thead>
          <tbody>
            {floor.jahre.map((row) => (
              <tr key={row.year}>
                <td>{row.year}</td>
                <td style={{ textAlign: "right" }}>{formatNumber(row.scale)}</td>
                <td style={{ textAlign: "right" }}>
                  {formatNumber(row.revenue_eur_per_mw, 0)}
                </td>
                <td style={{ textAlign: "right" }}>
                  {formatNumber(row.customer_payout, 0)}
                </td>
                <td
                  style={{
                    textAlign: "right",
                    color: row.e2m_share < 0 ? "#b3261e" : undefined,
                    fontWeight: row.e2m_share < 0 ? 600 : undefined,
                  }}
                >
                  {formatNumber(row.e2m_share, 0)}
                </td>
                <td style={{ textAlign: "right" }}>
                  {formatNumber(row.e2m_cumulative_npv, 0)}
                </td>
              </tr>
            ))}
          </tbody>
          {letztesJahr && (
            <tfoot>
              <tr>
                <th>Summe</th>
                <th />
                <th />
                <th style={{ textAlign: "right" }}>
                  {formatNumber(floor.summary.total_customer, 0)}
                </th>
                <th style={{ textAlign: "right" }}>
                  {formatNumber(floor.summary.total_e2m, 0)}
                </th>
                <th style={{ textAlign: "right" }}>
                  {formatNumber(letztesJahr.e2m_cumulative_npv, 0)}
                </th>
              </tr>
            </tfoot>
          )}
        </table>
        <p className="muted">
          Alle Werte pro MW Bezugsleistung, ohne die fixen Bausteine
          (Integrationspauschale, monatlicher Betrag, DL-Entgelt).
        </p>
      </details>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Bausteine                                                           */
/* ------------------------------------------------------------------ */

interface ModellButtonProps {
  active: boolean;
  label: string;
  hint: string;
  disabled?: boolean;
  onClick: () => void;
}

function ModellButton({ active, label, hint, disabled, onClick }: ModellButtonProps) {
  return (
    <button
      type="button"
      className={`cockpit-modell ${active ? "cockpit-modell--active" : ""}`}
      disabled={disabled}
      aria-pressed={active}
      onClick={onClick}
    >
      <span className="cockpit-modell__label">{label}</span>
      <span className="cockpit-modell__hint">{hint}</span>
    </button>
  );
}

function StatusChip({ ok }: { ok: boolean }) {
  return (
    <span className={`cockpit-status ${ok ? "cockpit-status--ok" : "cockpit-status--bad"}`}>
      {ok ? "Leitplanken erfüllt" : "Leitplanken nicht erfüllt"}
    </span>
  );
}

function WarnList({ items }: { items: string[] }) {
  return (
    <ul
      className="error-banner"
      style={{ background: "#fff8e6", borderColor: "#f2d59b", color: "#7a5b13" }}
    >
      {items.map((w, idx) => (
        <li key={idx}>{w}</li>
      ))}
    </ul>
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
    <div className={`cockpit-field ${solved ? "cockpit-field--solved" : ""}`}>
      <span className="cockpit-field__label">{label}</span>
      <span className="cockpit-field__hint">{hint}</span>
      {solved ? (
        <div className="cockpit-field__value">
          {solvedValue !== undefined ? formatNumber(solvedValue) : "—"}
          <span className="cockpit-field__tag">gesolved</span>
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

function KpiTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "ok" | "bad" | "warn" | "muted";
}) {
  return (
    <div className={`cockpit-kpi ${tone ? `cockpit-kpi--${tone}` : ""}`}>
      <div className="cockpit-kpi__label">{label}</div>
      <div className="cockpit-kpi__value">{value}</div>
      {hint && <div className="cockpit-kpi__hint">{hint}</div>}
    </div>
  );
}
