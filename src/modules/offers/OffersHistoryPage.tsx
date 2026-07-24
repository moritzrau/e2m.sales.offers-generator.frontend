import { useQuery } from "@tanstack/react-query";

import { api } from "../../api/client";
import type { Backtest, OfferSummary, Profile } from "../../api/types";
import { formatDateTime } from "./format";

export type OfferMode = "interaktiv" | "oneclick";

interface Props {
  profile: Profile;
  onNew: (modus: OfferMode) => void;
  onOpen: (offerId: number) => void;
}

const STATUS_LABEL: Record<OfferSummary["status"], string> = {
  draft: "Entwurf",
  queued: "In Warteschlange",
  running: "Läuft",
  done: "Fertig",
  failed: "Fehlgeschlagen",
  final: "Freigegeben",
};

export function OffersHistoryPage({ profile, onNew, onOpen }: Props) {
  const offers = useQuery<OfferSummary[]>({
    queryKey: ["offers"],
    queryFn: () => api.get<OfferSummary[]>("/api/offers"),
    refetchInterval: (query) => {
      const data = query.state.data ?? [];
      const stillRunning = data.some((o) => o.status === "running" || o.status === "queued");
      return stillRunning ? 2000 : false;
    },
  });

  const backtests = useQuery<Backtest[]>({
    queryKey: ["backtests"],
    queryFn: () => api.get<Backtest[]>("/api/backtests"),
  });

  const nameByBacktest = new Map(
    (backtests.data ?? []).map((b) => [b.id, b.original_filename] as const),
  );

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Angebote</h2>
          <p>Historie deiner Angebote — Backtesting hochladen, Angebot zusammenstellen, PPTX herunterladen.</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            className="primary-btn primary-btn--inline"
            onClick={() => onNew("interaktiv")}
          >
            Interaktiv erstellen
          </button>
          <button
            className="primary-btn primary-btn--inline"
            onClick={() => onNew("oneclick")}
            style={{ background: "#1057c8" }}
            title="Backtesting wählen oder Use Case — alles Weitere übernimmt der Cockpit-Solver."
          >
            One-Click
          </button>
        </div>
      </div>

      {offers.isLoading ? (
        <p className="muted">Lade Angebote …</p>
      ) : offers.data && offers.data.length > 0 ? (
        <div className="card">
          <table className="offers-table">
            <thead>
              <tr>
                <th>Erstellt</th>
                <th>Backtesting</th>
                <th>Status</th>
                <th>Von</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {offers.data.map((offer) => (
                <tr key={offer.id}>
                  <td>{formatDateTime(offer.created_at)}</td>
                  <td className="offers-table__file">
                    {nameByBacktest.get(offer.backtest_id) ?? `#${offer.backtest_id}`}
                  </td>
                  <td>
                    <span className={`badge badge--${offer.status}`}>{STATUS_LABEL[offer.status]}</span>
                  </td>
                  <td>{offer.profile_id === profile.id ? "Ich" : `#${offer.profile_id}`}</td>
                  <td>
                    <button className="link-btn" onClick={() => onOpen(offer.id)}>
                      Öffnen →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            Noch keine Angebote. Klicke oben rechts auf „Neues Angebot".
          </p>
        </div>
      )}
    </div>
  );
}
