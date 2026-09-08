import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactECharts from "echarts-for-react";

import { api, ApiError } from "../../../api/client";
import type { BacktestingAnalyzeResult } from "../../../api/types";
import { formatEUR } from "../../offers/format";
import {
  buildDayFcrOption,
  buildDayPriceRevenueOption,
  buildDayProfileOption,
  buildDayScheduleOption,
  type DayProfileResponse,
  type DetailDayResponse,
} from "../charts/dayCharts";

interface CatalogParams {
  use_case: string;
  combo_key: string;
  duration_h: number;
  pv_mw?: number | null;
  bess_mw?: number | null;
  include_eeg?: boolean;
}

interface TabTagesdetailProps {
  result: BacktestingAnalyzeResult;
  useCase: string;
  catalogParams?: CatalogParams;
}

function defaultDateFromResult(result: BacktestingAnalyzeResult): string {
  const first = result.monthly[0]?.month;
  if (!first) return "2025-06-15";
  const d = new Date(first);
  if (Number.isNaN(d.getTime())) return "2025-06-15";
  d.setDate(15);
  return d.toISOString().slice(0, 10);
}

function resolveCatalogParams(
  result: BacktestingAnalyzeResult,
  useCase: string,
  catalogParams?: CatalogParams,
): CatalogParams | null {
  if (catalogParams?.combo_key) return catalogParams;
  if (result.preset_key) {
    return {
      use_case: catalogParams?.use_case ?? useCase ?? result.use_case,
      combo_key: result.preset_key,
      duration_h: catalogParams?.duration_h ?? result.duration_h,
      pv_mw: catalogParams?.pv_mw ?? result.scaled_sizes.pv_mw,
      bess_mw: catalogParams?.bess_mw ?? result.scaled_sizes.bess_mw,
      include_eeg: catalogParams?.include_eeg,
    };
  }
  return catalogParams ?? null;
}

function buildQueryString(params: CatalogParams, extra: Record<string, string>): string {
  const qs = new URLSearchParams();
  qs.set("use_case", params.use_case);
  qs.set("combo_key", params.combo_key);
  qs.set("duration_h", String(params.duration_h));
  if (params.pv_mw != null) qs.set("pv_mw", String(params.pv_mw));
  if (params.bess_mw != null) qs.set("bess_mw", String(params.bess_mw));
  if (params.include_eeg !== undefined) qs.set("include_eeg", String(params.include_eeg));
  for (const [key, value] of Object.entries(extra)) {
    if (value) qs.set(key, value);
  }
  return qs.toString();
}

function friendlyApiError(err: unknown, feature: string): string {
  if (err instanceof ApiError) {
    if (err.status === 404 || err.status === 501) {
      return `${feature} ist derzeit noch nicht verfügbar (Server meldet ${err.status}). Bitte später erneut versuchen.`;
    }
    if (err.status === 503) {
      return "Backtesting-Daten sind auf dem Server nicht konfiguriert.";
    }
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return `${feature} konnte nicht geladen werden.`;
}

export function TabTagesdetail({ result, useCase, catalogParams }: TabTagesdetailProps) {
  const resolvedParams = useMemo(
    () => resolveCatalogParams(result, useCase, catalogParams),
    [catalogParams, result, useCase],
  );

  const [date, setDate] = useState(() => defaultDateFromResult(result));
  const [profileMonth, setProfileMonth] = useState<string>("");
  const [detail, setDetail] = useState<DetailDayResponse | null>(null);
  const [profile, setProfile] = useState<DayProfileResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const isStandalone = (resolvedParams?.use_case ?? useCase) === "standalone_bess";
  const showPv = !isStandalone;

  const monthOptions = useMemo(
    () =>
      result.monthly.map((m) => ({
        value: m.month.slice(0, 7),
        label: m.month_label,
      })),
    [result.monthly],
  );

  const loadData = useCallback(async () => {
    if (!resolvedParams?.combo_key) {
      setError("Katalog-Parameter fehlen — Tagesdetail kann nicht geladen werden.");
      return;
    }

    setLoading(true);
    setError(null);
    setProfileError(null);

    const baseQs = buildQueryString(resolvedParams, { date });
    const profileQs = buildQueryString(resolvedParams, {
      ...(profileMonth ? { month: profileMonth } : {}),
    });

    try {
      const detailData = await api.get<DetailDayResponse>(`/api/backtesting/detail?${baseQs}`);
      setDetail(detailData);
    } catch (err) {
      setDetail(null);
      setError(friendlyApiError(err, "Tagesdetail"));
    }

    try {
      const profileData = await api.get<DayProfileResponse>(
        `/api/backtesting/day-profile?${profileQs}`,
      );
      setProfile(profileData);
    } catch (err) {
      setProfile(null);
      setProfileError(friendlyApiError(err, "Tagesprofil"));
    } finally {
      setLoading(false);
    }
  }, [date, profileMonth, resolvedParams]);

  // Beim Oeffnen des Tabs sofort laden — das Datum ist ohnehin vorbelegt.
  const autoLoaded = useRef(false);
  useEffect(() => {
    if (autoLoaded.current) return;
    if (!resolvedParams?.combo_key) return;
    autoLoaded.current = true;
    void loadData();
  }, [resolvedParams, loadData]);

  const scheduleOption = useMemo(
    () => (detail?.rows.length ? buildDayScheduleOption(detail.rows, { showPv }) : null),
    [detail, showPv],
  );

  const priceRevenueOption = useMemo(
    () => (detail?.rows.length ? buildDayPriceRevenueOption(detail.rows) : null),
    [detail],
  );

  const showFcr =
    isStandalone && detail?.rows.some((r) => Math.abs(r.fcr_pos_mw) > 1e-6 || Math.abs(r.fcr_neg_mw) > 1e-6);

  const fcrOption = useMemo(
    () => (showFcr && detail?.rows.length ? buildDayFcrOption(detail.rows) : null),
    [detail, showFcr],
  );

  const profileOption = useMemo(
    () => (profile?.hours.length ? buildDayProfileOption(profile, { showPv }) : null),
    [profile, showPv],
  );

  const dayTotalRevenue = useMemo(() => {
    if (!detail?.rows.length) return null;
    return detail.rows.reduce((acc, r) => acc + r.total_revenue_eur, 0);
  }, [detail]);

  return (
    <div>
      <div className="bt-card" style={{ marginBottom: "1.25rem" }}>
        <div className="bt-form" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
          <label className="bt-field">
            <span>Datum</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="bt-field">
            <span>Monat für Ø Tagesprofil</span>
            <select value={profileMonth} onChange={(e) => setProfileMonth(e.target.value)}>
              <option value="">Gesamtjahr</option>
              {monthOptions.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <div className="bt-field">
            <span>&nbsp;</span>
            <button
              type="button"
              className="bt-btn bt-btn--primary"
              onClick={() => void loadData()}
              disabled={loading || !resolvedParams?.combo_key}
            >
              {loading ? "Lade …" : "Aktualisieren"}
            </button>
          </div>
        </div>
      </div>

      {!resolvedParams?.combo_key && (
        <div className="error-banner">Katalog-Parameter (combo_key) fehlen für den API-Aufruf.</div>
      )}

      {error && <div className="error-banner">{error}</div>}
      {profileError && !error && <div className="error-banner">{profileError}</div>}

      {loading && (
        <div className="bt-card" aria-busy="true">
          <div className="bt-skel bt-skel--line" style={{ width: "30%" }} />
          <div className="bt-skel bt-skel--chart" />
        </div>
      )}

      {detail && !loading && (
        <>
          <p className="bt-hint" style={{ marginTop: 0, marginBottom: "1rem" }}>
            {detail.date}
            {dayTotalRevenue !== null && <> · Tageserlös gesamt <b>{formatEUR(dayTotalRevenue)}</b></>}
          </p>

          {detail.rows.length === 0 ? (
            <div className="bt-empty">
              <strong>Keine Daten für dieses Datum</strong>
              Wählen Sie ein Datum innerhalb des Backtesting-Zeitraums.
            </div>
          ) : (
            <>
              <section className="bt-section">
                <div className="bt-section__head">
                  <h4>Fahrplan</h4>
                  <p>
                    Erzeugung, Laden und Entladen im Viertelstundenraster, dazu der Ladestand.
                  </p>
                </div>
                <div className="bt-card">
                  {scheduleOption && (
                    <ReactECharts option={scheduleOption} style={{ height: 340 }} notMerge lazyUpdate />
                  )}
                </div>
              </section>

              <section className="bt-section">
                <div className="bt-section__head">
                  <h4>Preis und kumulierter Tageserlös</h4>
                  <p>
                    <b>Negative Preise sind rot unterlegt</b> — dort verdient der Speicher am
                    Laden, nicht am Verkaufen.
                  </p>
                </div>
                <div className="bt-card">
                  {priceRevenueOption && (
                    <ReactECharts option={priceRevenueOption} style={{ height: 300 }} notMerge lazyUpdate />
                  )}
                </div>
              </section>

              {fcrOption && (
                <section className="bt-section">
                  <div className="bt-section__head">
                    <h4>FCR-Abrufe</h4>
                    <p>Vorgehaltene Leistung positiv und negativ.</p>
                  </div>
                  <div className="bt-card">
                    <ReactECharts option={fcrOption} style={{ height: 280 }} notMerge lazyUpdate />
                  </div>
                </section>
              )}
            </>
          )}
        </>
      )}

      {profile && !loading && profileOption && (
        <section className="bt-section">
          <div className="bt-section__head">
            <h4>Ø Tagesprofil{profile.month ? ` — ${profile.month}` : " — Gesamtjahr"}</h4>
            <p>Der typische Tag im gewählten Zeitraum, gemittelt über alle Tage.</p>
          </div>
          <div className="bt-card">
            <ReactECharts option={profileOption} style={{ height: 320 }} notMerge lazyUpdate />
          </div>
        </section>
      )}
    </div>
  );
}
