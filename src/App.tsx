import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { ApiError, api } from "./api/client";
import type { Profile } from "./api/types";
import { AppShell } from "./shell/AppShell";
import { ProfileSelect } from "./shell/ProfileSelect";
import { BacktestingPage } from "./modules/backtesting/BacktestingPage";
import { BacktestRequestsPage } from "./modules/backtest-requests/BacktestRequestsPage";
import { HomePage } from "./modules/home/HomePage";
import { OfferResultRoute } from "./modules/offers/OfferResultRoute";
import { OffersListRoute } from "./modules/offers/OffersListRoute";
import { OfferWizardRoute } from "./modules/offers/OfferWizardRoute";

export default function App() {
  const queryClient = useQueryClient();

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
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell profile={me} onSwitchProfile={switchProfile} />}>
          <Route path="/" element={<HomePage profile={me} />} />
          <Route path="/backtesting" element={<BacktestingPage />} />
          <Route path="/backtest-anfragen" element={<BacktestRequestsPage />} />
          <Route path="/angebote" element={<OffersListRoute profile={me} />} />
          <Route path="/angebote/neu" element={<OfferWizardRoute profile={me} />} />
          <Route path="/angebote/:id" element={<OfferResultRoute />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
