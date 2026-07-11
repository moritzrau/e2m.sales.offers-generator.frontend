import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { ApiError, api } from "./api/client";
import type { Profile } from "./api/types";
import { Layout } from "./shell/Layout";
import type { NavKey } from "./shell/nav";
import { ProfileSelect } from "./shell/ProfileSelect";
import { DashboardPage } from "./modules/dashboard/DashboardPage";
import { OffersModule } from "./modules/offers/OffersModule";
import { PlaceholderPage } from "./modules/PlaceholderPage";

export default function App() {
  const queryClient = useQueryClient();
  const [nav, setNav] = useState<NavKey>("dashboard");

  const meQuery = useQuery<Profile | null>({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        return await api.get<Profile>("/api/me");
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
  });

  if (meQuery.isLoading) {
    return <div className="screen-center muted">Lade …</div>;
  }

  if (meQuery.isError) {
    return (
      <div className="screen-center">
        <div className="error-banner">
          Backend nicht erreichbar. Läuft der Server? ({String(meQuery.error)})
        </div>
      </div>
    );
  }

  const me = meQuery.data ?? null;

  if (!me) {
    return <ProfileSelect onSelected={() => queryClient.invalidateQueries({ queryKey: ["me"] })} />;
  }

  const switchProfile = async () => {
    await api.post("/api/profiles/logout");
    queryClient.invalidateQueries({ queryKey: ["me"] });
  };

  return (
    <Layout nav={nav} onNavChange={setNav} profile={me} onSwitchProfile={switchProfile}>
      {nav === "dashboard" && <DashboardPage profile={me} />}
      {nav === "offers" && <OffersModule profile={me} />}
      {nav === "backtesting" && (
        <PlaceholderPage
          title="Backtesting"
          text="Das Backtesting-Modul (Messe-Tool) wird mit Meilenstein M4 integriert. Bis dahin bleibt das bestehende Messe-Tool eigenständig erreichbar."
        />
      )}
      {nav === "pricing" && (
        <PlaceholderPage
          title="Pricing"
          text="Das Pricing-Modul (Floor-Analyse, später Tolling) kommt mit Meilenstein M3."
        />
      )}
    </Layout>
  );
}
