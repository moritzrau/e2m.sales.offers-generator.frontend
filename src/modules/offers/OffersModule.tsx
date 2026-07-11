import { useState } from "react";

import type { Profile } from "../../api/types";
import { OffersHistoryPage } from "./OffersHistoryPage";
import { OfferWizard } from "./OfferWizard";
import { OfferResultPage } from "./OfferResultPage";

type View = { kind: "list" } | { kind: "wizard" } | { kind: "result"; offerId: number };

interface Props {
  profile: Profile;
}

export function OffersModule({ profile }: Props) {
  const [view, setView] = useState<View>({ kind: "list" });

  if (view.kind === "wizard") {
    return (
      <OfferWizard
        profile={profile}
        onCancel={() => setView({ kind: "list" })}
        onCreated={(offerId) => setView({ kind: "result", offerId })}
      />
    );
  }

  if (view.kind === "result") {
    return (
      <OfferResultPage
        offerId={view.offerId}
        onBack={() => setView({ kind: "list" })}
      />
    );
  }

  return (
    <OffersHistoryPage
      profile={profile}
      onNew={() => setView({ kind: "wizard" })}
      onOpen={(offerId) => setView({ kind: "result", offerId })}
    />
  );
}
