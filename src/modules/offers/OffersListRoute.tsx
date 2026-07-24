import { useNavigate } from "react-router-dom";

import type { Profile } from "../../api/types";
import { OffersHistoryPage } from "./OffersHistoryPage";

interface Props {
  profile: Profile;
}

export function OffersListRoute({ profile }: Props) {
  const navigate = useNavigate();
  return (
    <OffersHistoryPage
      profile={profile}
      onNew={(modus) => navigate(`/angebote/neu?modus=${modus}`)}
      onOpen={(offerId) => navigate(`/angebote/${offerId}`)}
    />
  );
}
