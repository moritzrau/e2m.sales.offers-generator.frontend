import { Outlet } from "react-router-dom";

import type { Profile } from "../api/types";
import { Header } from "./Header";

interface Props {
  profile: Profile;
  onSwitchProfile: () => void;
}

export function AppShell({ profile, onSwitchProfile }: Props) {
  return (
    <div className="app-shell">
      <Header profile={profile} onSwitchProfile={onSwitchProfile} />
      <main className="app-main">
        <div className="app-main__inner">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
