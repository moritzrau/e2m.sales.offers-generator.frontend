import { NavLink, Link } from "react-router-dom";

import type { Profile } from "../api/types";
import { NAV_ITEMS } from "./nav";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

interface Props {
  profile: Profile;
  onSwitchProfile: () => void;
}

export function Header({ profile, onSwitchProfile }: Props) {
  return (
    <header className="app-header">
      <div className="app-header__inner">
        <Link to="/" className="app-header__brand">
          <span className="app-header__logo">e2m</span>
          <span className="app-header__title">Sales Tool</span>
        </Link>

        <nav className="app-header__nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `header-nav-link ${isActive ? "header-nav-link--active" : ""}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="profile-chip" title={profile.role ?? undefined}>
          <span className="profile-chip__avatar">{initials(profile.name)}</span>
          <span className="profile-chip__name">{profile.name}</span>
          <button className="profile-chip__switch" onClick={onSwitchProfile}>
            Wechseln
          </button>
        </div>
      </div>
    </header>
  );
}
