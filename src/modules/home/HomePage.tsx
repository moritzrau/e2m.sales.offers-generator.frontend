import { Link } from "react-router-dom";

import type { Profile } from "../../api/types";

interface Props {
  profile: Profile;
}

interface Tile {
  to: string;
  title: string;
  description: string;
}

const TILES: Tile[] = [
  {
    to: "/backtesting",
    title: "Backtesting",
    description:
      "Standard-Katalog live analysieren oder eigenes Backtesting hochladen und visualisieren.",
  },
  {
    to: "/angebote",
    title: "Angebote",
    description:
      "Historie der Angebote, neue Angebote aus einem Backtesting zusammenstellen.",
  },
  {
    to: "/backtest-anfragen",
    title: "Backtest anfragen",
    description:
      "Anlagenparameter an PFM übermitteln — Ergebnis wird nach Berechnung automatisch importiert.",
  },
];

export function HomePage({ profile }: Props) {
  const firstName = profile.name.split(/\s+/)[0] ?? profile.name;

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Hallo {firstName}</h2>
          <p>Dein Einstieg in Backtesting, Angebote und PFM-Anfragen.</p>
        </div>
      </div>

      <div className="home-tiles">
        {TILES.map((tile) => (
          <Link key={tile.to} to={tile.to} className="home-tile">
            <h3>{tile.title}</h3>
            <p>{tile.description}</p>
            <span className="home-tile__cta">Öffnen →</span>
          </Link>
        ))}
      </div>
    </>
  );
}
