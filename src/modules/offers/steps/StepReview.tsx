import type { OfferParams, PrecheckOut } from "../../../api/types";

interface Props {
  precheck: PrecheckOut | undefined;
  params: OfferParams;
  composition: string[];
  leadId: number | null;
  onSubmit: () => void;
  submitting: boolean;
}

export function StepReview({ precheck, params, composition, leadId, onSubmit, submitting }: Props) {
  return (
    <div className="wizard-step">
      <h3>5. Start</h3>
      <p className="muted">Zusammenfassung — dann Rechenpipeline starten.</p>

      <dl className="review-list">
        <dt>Backtesting-Typ</dt>
        <dd>{precheck?.backtest_type ?? "—"}</dd>
        <dt>Lead</dt>
        <dd>{leadId !== null ? `#${leadId}` : "keiner"}</dd>
        <dt>Vertragsmodell</dt>
        <dd>{params.vertragsmodell ?? "DA"}</dd>
        <dt>Vermarktungsentgelt</dt>
        <dd>{params.dienstleistungsentgelt_eur_per_mwh ?? "Default"} €/MWh</dd>
        <dt>Anteil Mehrerlöse e2m</dt>
        <dd>{params.anteil_mehrerloes_e2m ?? "Default"}</dd>
        <dt>Blöcke</dt>
        <dd>{composition.length} Blöcke</dd>
      </dl>

      <button className="primary-btn" onClick={onSubmit} disabled={submitting}>
        {submitting ? "Angebot wird angelegt …" : "Angebot berechnen"}
      </button>
    </div>
  );
}
