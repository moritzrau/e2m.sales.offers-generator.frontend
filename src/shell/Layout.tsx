import type { ReactNode } from "react";

import type { Profile } from "../api/types";
import { NAV_ITEMS, type NavKey } from "./nav";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

interface Props {
  nav: NavKey;
  onNavChange: (nav: NavKey) => void;
  profile: Profile;
  onSwitchProfile: () => void;
  children: ReactNode;
}

export function Layout({ nav, onNavChange, profile, onSwitchProfile, children }: Props) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <h1>e2m Sales Tool</h1>
          <div className="sidebar-brand__divider" />
        </div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              className={`nav-btn ${nav === item.key ? "active" : ""}`}
              onClick={() => onNavChange(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="sidebar-footer__note">energy2markets · intern</span>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div className="profile-chip" title={profile.role ?? undefined}>
            <span className="profile-chip__avatar">{initials(profile.name)}</span>
            <span className="profile-chip__name">{profile.name}</span>
            <button className="profile-chip__switch" onClick={onSwitchProfile}>
              Wechseln
            </button>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
