import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ReactECharts from "echarts-for-react";

import { ApiError, api } from "../../api/client";
import type { Job, OfferArtifact, OfferDetail, OfferSummary } from "../../api/types";
import { formatBytes, formatDateTime, formatEUR, formatNumber } from "./format";

interface Props {
  offerId: number;
  onBack: () => void;
}

const STATUS_LABEL: Record<OfferSummary["status"], string> = {
  draft: "Entwurf",
  queued: "Warteschlange",
  running: "Läuft",
  done: "Fertig",
  failed: "Fehlgeschlagen",
  final: "Freigegeben",
};

const KPI_ORDER: { key: string; label: string; kind?: "eur" | "count" }[] = [
  { key: "gesamterloes_eur", label: "Gesamterlös", kind: "eur" },
  { key: "grundverguetung_eur", label: "Grundvergütung", kind: "eur" },
  { key: "mehrerloese_eur", label: "Mehrerlöse", kind: "eur" },
  { key: "eeg_revenue_eur", label: "Marktprämie (EEG)", kind: "eur" },
  { key: "gesamterloes_pvonly_eur", label: "PV-only Vergleich", kind: "eur" },
  { key: "erloesdifferenz_eur", label: "Erlösdifferenz", kind: "eur" },
  { key: "total_revenue_eur", label: "Total Revenue", kind: "eur" },
  { key: "total_revenue_bess_eur", label: "BESS Total", kind: "eur" },
  { key: "pv_da_eur", label: "PV (DA)", kind: "eur" },
  { key: "fcr_eur", label: "FCR", kind: "eur" },
  { key: "afrr_pos_eur", label: "aFRR Pos", kind: "eur" },
  { key: "afrr_neg_eur", label: "aFRR Neg", kind: "eur" },
  { key: "wholesale_eur", label: "Wholesale", kind: "eur" },
  { key: "n_months", label: "Monate", kind: "count" },
];

export function OfferResultPage({ offerId, onBack }: Props) {
  const queryClient = useQueryClient();

  const offerQuery = useQuery<OfferDetail>({
    queryKey: ["offer", offerId],
    queryFn: () => api.get<OfferDetail>(`/api/offers/${offerId}`),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "running" || status === "queued" ? 1500 : false;
    },
  });

  const jobQuery = useQuery<Job>({
    queryKey: ["job", offerQuery.data?.job_id],
    queryFn: () => api.get<Job>(`/api/jobs/${offerQuery.data!.job_id}`),
    enabled: !!offerQuery.data?.job_id,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "running" || status === "queued" ? 1000 : false;
    },
  });

  const finalizeMutation = useMutation<OfferSummary, ApiError>({
    mutationFn: () => api.post<OfferSummary>(`/api/offers/${offerId}/finalize`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["offer", offerId] });
      queryClient.invalidateQueries({ queryKey: ["offers"] });
    },
  });

  if (offerQuery.isLoading) {
    return <p className="muted">Lade Angebot …</p>;
  }
  if (offerQuery.isError || !offerQuery.data) {
    return (
      <div>
        <button className="link-btn" onClick={onBack}>
          ← Zurück
        </button>
        <div className="error-banner">Angebot konnte nicht geladen werden.</div>
      </div>
    );
  }

  const offer = offerQuery.data;
  const isRunning = offer.status === "running" || offer.status === "queued";
  const isDone = offer.status === "done" || offer.status === "final";

  return (
    <div>
      <div className="page-head">
        <div>
          <button className="link-btn" onClick={onBack}>
            ← Angebote
          </button>
          <h2>Angebot #{offer.id}</h2>
          <p>
            Erstellt {formatDateTime(offer.created_at)} · Status:{" "}
            <span className={`badge badge--${offer.status}`}>{STATUS_LABEL[offer.status]}</span>
          </p>
        </div>
        {isDone && offer.status !== "final" && (
          <button
            className="primary-btn primary-btn--inline"
            onClick={() => finalizeMutation.mutate()}
            disabled={finalizeMutation.isPending}
          >
            {finalizeMutation.isPending ? "Freigebe …" : "Freigeben"}
          </button>
        )}
      </div>

      {finalizeMutation.error && (
        <div className="error-banner">{finalizeMutation.error.message}</div>
      )}

      {offer.status === "final" && (
        <div className="precheck-box">
          Freigegeben am {offer.released_at ? formatDateTime(offer.released_at) : "—"}
          {offer.sink_dir ? (
            <> · Team-Ordner: <code>{offer.sink_dir}</code></>
          ) : (
            <> · <em>Kein Team-Ordner konfiguriert — Artefakte nur lokal.</em></>
          )}
        </div>
      )}

      {isRunning && (
        <div className="card">
          <h3>Berechne …</h3>
          <p className="muted">{jobQuery.data?.message ?? "Auftrag läuft."}</p>
          <div className="progress">
            <div
              className="progress__bar"
              style={{ width: `${jobQuery.data?.progress ?? 0}%` }}
            />
          </div>
        </div>
      )}

      {offer.status === "failed" && (
        <div className="error-banner">
          Pipeline fehlgeschlagen: {jobQuery.data?.message ?? "unbekannter Fehler"}
        </div>
      )}

      {isDone && offer.kpis && (
        <div className="card">
          <h3>Kennzahlen</h3>
          <div className="kpi-grid">
            {KPI_ORDER.filter(({ key }) => key in offer.kpis!).map(({ key, label, kind }) => {
              const value = offer.kpis![key] as number;
              return (
                <div key={key} className="kpi-tile">
                  <span className="muted">{label}</span>
                  <strong>{kind === "count" ? formatNumber(value, 0) : formatEUR(value)}</strong>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isDone && offer.df_monthly && offer.df_monthly.length > 0 && (
        <div className="card" style={{ marginTop: "1rem" }}>
          <h3>Monatliche Erlöse</h3>
          <MonthlyChart records={offer.df_monthly} />
        </div>
      )}

      {isDone && (
        <div className="card" style={{ marginTop: "1rem" }}>
          <h3>Downloads</h3>
          <ArtifactList artifacts={offer.artifacts} offerId={offer.id} />
        </div>
      )}
    </div>
  );
}

function ArtifactList({
  artifacts,
  offerId,
}: {
  artifacts: OfferArtifact[];
  offerId: number;
}) {
  if (artifacts.length === 0) return <p className="muted">Noch keine Dateien vorhanden.</p>;
  return (
    <ul className="artifact-list">
      {artifacts.map((a) => (
        <li key={a.name}>
          <a href={`/api/offers/${offerId}/artifacts/${a.name}`} download>
            {a.name}
          </a>
          <span className="badge badge--muted">{a.kind}</span>
          <span className="muted">{formatBytes(a.size_bytes)}</span>
        </li>
      ))}
    </ul>
  );
}

function MonthlyChart({ records }: { records: Record<string, unknown>[] }) {
  const monthKey = "month" in records[0] ? "month" : "Months";
  const months = records
    .map((r) => String(r[monthKey] ?? ""))
    .filter((m) => m && m !== "Total");
  const filtered = records.filter((r) => String(r[monthKey]) !== "Total");

  // Erlös-Serien: nimm die typischen Spalten je Use Case, wenn vorhanden.
  const candidateSeries: { key: string; label: string; color: string }[] = [
    { key: "grundverguetung", label: "Grundvergütung", color: "#001A70" },
    { key: "mehrerloese", label: "Mehrerlöse", color: "#FE5716" },
    { key: "eeg_revenue", label: "Marktprämie", color: "#4F9E30" },
    { key: "FCR", label: "FCR", color: "#F5A623" },
    { key: "aFRR Pos", label: "aFRR Pos", color: "#4F9E30" },
    { key: "aFRR Neg", label: "aFRR Neg", color: "#3D8BFD" },
    { key: "Wholesale", label: "Wholesale", color: "#001A70" },
    { key: "revenuePV_DA", label: "PV (DA)", color: "#FE5716" },
  ];

  const activeSeries = candidateSeries
    .filter((s) => filtered.some((r) => typeof r[s.key] === "number" && (r[s.key] as number) !== 0))
    .map((s) => ({
      name: s.label,
      type: "bar" as const,
      stack: "erloes",
      data: filtered.map((r) => (typeof r[s.key] === "number" ? Math.round(r[s.key] as number) : 0)),
      itemStyle: { color: s.color },
    }));

  const option = {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      valueFormatter: (v: number) =>
        `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(v)} €`,
    },
    legend: { bottom: 0 },
    grid: { left: 60, right: 20, top: 20, bottom: 60 },
    xAxis: { type: "category", data: months },
    yAxis: {
      type: "value",
      axisLabel: {
        formatter: (v: number) => new Intl.NumberFormat("de-DE", { notation: "compact" }).format(v),
      },
    },
    series: activeSeries,
  };
  return <ReactECharts option={option} style={{ height: 380 }} notMerge lazyUpdate />;
}
