import { useNavigate, useParams } from "react-router-dom";

import { OfferResultPage } from "./OfferResultPage";

export function OfferResultRoute() {
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const offerId = Number(params.id);

  if (!Number.isFinite(offerId) || offerId <= 0) {
    return (
      <div>
        <button className="link-btn" onClick={() => navigate("/angebote")}>
          ← Angebote
        </button>
        <div className="error-banner">Ungültige Angebots-ID.</div>
      </div>
    );
  }

  return <OfferResultPage offerId={offerId} onBack={() => navigate("/angebote")} />;
}
