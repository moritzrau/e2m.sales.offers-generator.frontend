import { useNavigate, useSearchParams } from "react-router-dom";

import type { Profile } from "../../api/types";
import { OfferWizard } from "./OfferWizard";
import { OneClickPage } from "./OneClickPage";

interface Props {
  profile: Profile;
}

export function OfferWizardRoute({ profile }: Props) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const modus = searchParams.get("modus");

  const onCancel = () => navigate("/angebote");
  const onCreated = (offerId: number) => navigate(`/angebote/${offerId}`);

  if (modus === "oneclick") {
    return <OneClickPage onCancel={onCancel} onCreated={onCreated} />;
  }
  return <OfferWizard profile={profile} onCancel={onCancel} onCreated={onCreated} />;
}
