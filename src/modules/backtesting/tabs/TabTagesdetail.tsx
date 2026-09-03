import { useCallback, useMemo, useState } from "react";
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
      <div className="profile-form" style={{ alignItems: "flex-end", marginBottom: "1rem" }}>
        <label>
          Datum
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label>
          Monat (Ø Tagesprofil)
          <select value={profileMonth} onChange={(e) => setProfileMonth(e.target.value)}>
            <option value="">Gesamtjahr</option>
            {monthOptions.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="primary-btn"
          onClick={() => void loadData()}
          disabled={loading || !resolvedParams?.combo_key}
        >
          {loading ? "Lade …" : "Laden"}
        </button>
      </div>

      {!resolvedParams?.combo_key && (
        <div className="error-banner">Katalog-Parameter (combo_key) fehlen für den API-Aufruf.</div>
      )}

      {error && <div className="error-banner">{error}</div>}
      {profileError && !error && <div className="error-banner">{profileError}</div>}

      {loading && <p className="muted">Lade Tagesdetail und Tagesprofil …</p>}

      {detail && !loading && (
        <>
          <p className="muted" style={{ marginTop: 0 }}>
            {detail.date}
            {dayTotalRevenue !== null && (
              <> · Tageserlös gesamt: {formatEUR(dayTotalRevenue)}</>
            )}
          </p>

          {detail.rows.length === 0 ? (
            <p className="muted">Keine Daten für dieses Datum vorhanden.</p>
          ) : (
            <>
              <h4 style={{ marginTop: 0 }}>Fahrplan</h4>
              {scheduleOption && (
                <ReactECharts option={scheduleOption} style={{ height: 320 }} notMerge lazyUpdate />
              )}

              <h4 style={{ marginTop: "1.25rem" }}>Preis & kumulierter Tageserlös</h4>
              {priceRevenueOption && (
                <ReactECharts
                  option={priceRevenueOption}
                  style={{ height: 280 }}
                  notMerge
                  lazyUpdate
                />
              )}

              {fcrOption && (
                <>
                  <h4 style={{ marginTop: "1.25rem" }}>FCR-Abrufe</h4>
                  <ReactECharts option={fcrOption} style={{ height: 260 }} notMerge lazyUpdate />
                </>
              )}
            </>
          )}
        </>
      )}

      {profile && !loading && profileOption && (
        <>
          <h4 style={{ marginTop: "1.25rem" }}>
            Ø Tagesprofil
            {profile.month ? ` (${profile.month})` : " (Gesamtjahr)"}
          </h4>
          <ReactECharts option={profileOption} style={{ height: 300 }} notMerge lazyUpdate />
        </>
      )}

      {!detail && !loading && !error && (
        <p className="muted">Datum wählen und „Laden" klicken, um Tagesdetail anzuzeigen.</p>
      )}
    </div>
  );
}
