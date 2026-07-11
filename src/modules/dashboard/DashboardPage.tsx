import type { Profile } from "../../api/types";

// Übergangsweise: Link auf das eigenständige Messe-Tool, bis M4 es integriert.
const LEGACY_BACKTESTING_URL = import.meta.env.VITE_LEGACY_BACKTESTING_URL ?? "";

interface Props {
  profile: Profile;
}

export function DashboardPage({ profile }: Props) {
  const firstName = profile.name.split(/\s+/)[0] ?? profile.name;

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Hallo {firstName}</h2>
          <p>Dein Einstieg in Angebote, Backtesting und Pricing.</p>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="card">
          <h3>Letzte Angebote</h3>
          <p className="muted">
            Noch keine Angebote vorhanden. Das Angebotstool kommt mit Meilenstein M1 — danach erscheinen
            hier die zuletzt erstellten Angebote des Teams.
          </p>
        </div>

        <div className="card">
          <h3>Neue Backtestings</h3>
          <p className="muted">
            Sobald der Watchfolder angebunden ist (M2), erscheinen hier neu abgelegte Backtestings vom
            H:-Laufwerk.
          </p>
        </div>

        <div className="card">
          <h3>Schnellzugriffe</h3>
          {LEGACY_BACKTESTING_URL ? (
            <a className="quick-link" href={LEGACY_BACKTESTING_URL} target="_blank" rel="noreferrer">
              Messe-Tool (Backtesting Lite) öffnen ↗
            </a>
          ) : (
            <p className="muted">
              Link zum bestehenden Messe-Tool folgt (Env-Variable <code>VITE_LEGACY_BACKTESTING_URL</code>).
            </p>
          )}
        </div>
      </div>
    </>
  );
}
