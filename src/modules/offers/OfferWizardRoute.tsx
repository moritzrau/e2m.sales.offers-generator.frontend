import { useNavigate } from "react-router-dom";

import type { Profile } from "../../api/types";
import { OfferWizard } from "./OfferWizard";

interface Props {
  profile: Profile;
}

export function OfferWizardRoute({ profile }: Props) {
  const navigate = useNavigate();
  return (
    <OfferWizard
      profile={profile}
      onCancel={() => navigate("/angebote")}
      onCreated={(offerId) => navigate(`/angebote/${offerId}`)}
    />
  );
}
