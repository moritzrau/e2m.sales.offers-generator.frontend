import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";

import { api, ApiError } from "../../api/client";
import type {
  Backtest,
  BlocksList,
  Lead,
  OfferParams,
  OfferSummary,
  PrecheckOut,
  Profile,
  UploadResult,
} from "../../api/types";
import { StepBacktesting } from "./steps/StepBacktesting";
import { StepBlocks } from "./steps/StepBlocks";
import { StepCockpit, type CockpitStepState } from "./steps/StepCockpit";
import { StepParams } from "./steps/StepParams";
import { StepReview } from "./steps/StepReview";
import { StepLead } from "./steps/StepLead";

interface Props {
  profile: Profile;
  onCancel: () => void;
  onCreated: (offerId: number) => void;
}

const STEP_LABELS = [
  "1. Backtesting",
  "2. Pricing-Cockpit",
  "3. Angebot",
  "4. Start",
];

export function OfferWizard({ onCancel, onCreated }: Props) {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const modus = searchParams.get("modus") === "oneclick" ? "oneclick" : "interaktiv";

  const [step, setStep] = useState(0);
  const [backtestId, setBacktestId] = useState<number | null>(null);
  const [leadId, setLeadId] = useState<number | null>(null);
  const [showLeadPicker, setShowLeadPicker] = useState(false);
  const [params, setParams] = useState<OfferParams>({ vertragsmodell: "DA" });
  const [composition, setComposition] = useState<string[] | null>(null);
  const [cockpitState, setCockpitState] = useState<CockpitStepState | null>(null);
  const [pricingResultId, setPricingResultId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const backtests = useQuery<Backtest[]>({
    queryKey: ["backtests"],
    queryFn: () => api.get<Backtest[]>("/api/backtests"),
  });
  const leads = useQuery<Lead[]>({
    queryKey: ["leads"],
    queryFn: () => api.get<Lead[]>("/api/leads"),
  });

  const precheck = useQuery<PrecheckOut>({
    queryKey: ["offer-precheck", backtestId],
    queryFn: () =>
      api.post<PrecheckOut>("/api/offers/precheck", { backtest_id: backtestId }),
    enabled: !!backtestId,
  });

  const blocks = useQuery<BlocksList>({
    queryKey: ["blocks", precheck.data?.use_case],
    queryFn: () =>
      api.get<BlocksList>(`/api/offers/blocks?use_case=${precheck.data?.use_case}`),
    enabled: !!precheck.data?.use_case,
  });

  const precheckBacktestId = precheck.data ? backtestId : null;
  useEffect(() => {
    setComposition(null);
    setPricingResultId(null);
    setCockpitState(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [precheckBacktestId]);

  const uploadMutation = useMutation<UploadResult, ApiError, File>({
    mutationFn: (file) => api.upload<UploadResult>("/api/offers/upload", file),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["backtests"] });
      setBacktestId(result.backtest.id);
    },
  });

  const savePricing = useMutation<{ pricing_result_id: number }, ApiError, void>({
    mutationFn: async () => {
      if (!cockpitState) throw new ApiError(400, "Kein Cockpit-Ergebnis vorhanden.");
      return api.post<{ pricing_result_id: number }>("/api/pricing/results", {
        use_case: cockpitState.useCase,
        inputs: cockpitState.result.inputs,
        result: cockpitState.result,
      });
    },
  });

  const createMutation = useMutation<OfferSummary, ApiError, void>({
    mutationFn: () =>
      api.post<OfferSummary>("/api/offers", {
        backtest_id: backtestId,
        lead_id: leadId,
        pricing_result_id: pricingResultId,
        params,
        composition,
      }),
    onSuccess: (offer) => {
      queryClient.invalidateQueries({ queryKey: ["offers"] });
      onCreated(offer.id);
    },
    onError: (err) => setError(err.message),
  });

  // Weiter-Freigabe je Schritt
  const canNext = (() => {
    if (step === 0) return backtestId !== null && precheck.data !== undefined;
    if (step === 1) return cockpitState !== null;
    if (step === 2) return blocks.data !== undefined;
    return true;
  })();

  const next = async () => {
    setError(null);
    // Beim Verlassen des Cockpit-Schritts das Solve-Ergebnis persistieren.
    if (step === 1 && cockpitState) {
      try {
        const r = await savePricing.mutateAsync();
        setPricingResultId(r.pricing_result_id);
      } catch (err) {
        setError((err as ApiError).message);
        return;
      }
    }
    if (step === 2 && composition === null && blocks.data) {
      setComposition(blocks.data.default_composition);
    }
    setStep((s) => Math.min(s + 1, STEP_LABELS.length - 1));
  };

  const back = () => {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  };

  const selectedLead = leads.data?.find((l) => l.id === leadId) ?? null;

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Neues Angebot</h2>
          <p>
            {modus === "oneclick"
              ? "One-Click-Modus (Preview): Backtesting wählen, alles andere übernimmt der Cockpit-Solver."
              : "Backtesting hochladen oder wählen, Pricing im Cockpit festlegen, Angebot zusammenstellen."}
          </p>
        </div>
        <button className="link-btn" onClick={onCancel}>
          Abbrechen
        </button>
      </div>

      <div className="wizard-stepper">
        {STEP_LABELS.map((label, idx) => (
          <span
            key={label}
            className={`wizard-stepper__item ${
              idx === step ? "active" : idx < step ? "done" : ""
            }`}
          >
            {label}
          </span>
        ))}
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        {step === 0 && (
          <StepBacktesting
            backtests={backtests.data ?? []}
            uploading={uploadMutation.isPending}
            uploadError={uploadMutation.error?.message}
            onUpload={(file) => uploadMutation.mutate(file)}
            selected={backtestId}
            onSelect={setBacktestId}
            precheck={precheck.data}
            precheckLoading={precheck.isFetching}
            precheckError={precheck.error?.message}
          />
        )}

        {step === 1 && backtestId !== null && precheck.data && (
          <StepCockpit
            backtestId={backtestId}
            precheck={precheck.data}
            onSolveChange={setCockpitState}
          />
        )}

        {step === 2 && blocks.data && precheck.data && (
          <div>
            <LeadRow
              lead={selectedLead}
              onOpen={() => setShowLeadPicker(true)}
              onClear={() => setLeadId(null)}
            />
            <StepParams
              precheck={precheck.data}
              params={params}
              onChange={setParams}
            />
            <StepBlocks
              blocks={blocks.data}
              composition={composition ?? blocks.data.default_composition}
              onChange={setComposition}
              useCase={precheck.data.use_case}
            />
          </div>
        )}

        {step === 3 && (
          <StepReview
            precheck={precheck.data}
            params={params}
            composition={composition ?? precheck.data?.default_composition ?? []}
            leadId={leadId}
            onSubmit={() => createMutation.mutate()}
            submitting={createMutation.isPending}
          />
        )}
      </div>

      <div className="wizard-nav">
        <button className="link-btn" onClick={back} disabled={step === 0}>
          ← Zurück
        </button>
        {step < STEP_LABELS.length - 1 && (
          <button
            className="primary-btn primary-btn--inline"
            onClick={next}
            disabled={!canNext || savePricing.isPending}
          >
            {step === 1 && savePricing.isPending
              ? "Speichere Pricing …"
              : "Weiter →"}
          </button>
        )}
      </div>

      {showLeadPicker && (
        <LeadPickerModal
          leads={leads.data ?? []}
          currentId={leadId}
          onClose={() => setShowLeadPicker(false)}
          onSelect={(id) => {
            setLeadId(id);
            setShowLeadPicker(false);
          }}
          onCreated={(lead) => {
            queryClient.invalidateQueries({ queryKey: ["leads"] });
            setLeadId(lead.id);
            setShowLeadPicker(false);
          }}
        />
      )}
    </div>
  );
}

interface LeadRowProps {
  lead: Lead | null;
  onOpen: () => void;
  onClear: () => void;
}

function LeadRow({ lead, onOpen, onClear }: LeadRowProps) {
  const label = lead
    ? (() => {
        const d = (lead.data_json ?? {}) as Record<string, unknown>;
        const name = (d.company_name as string) || (d.project_name as string) || `Lead #${lead.id}`;
        return `${name} (#${lead.id})`;
      })()
    : "kein Lead ausgewählt";
  return (
    <div className="lead-row">
      <span className="lead-row__label">Lead:</span>
      <span className="lead-row__value">{label}</span>
      <div className="lead-row__actions">
        <button className="link-btn" onClick={onOpen}>
          {lead ? "Ändern" : "Auswählen / anlegen"}
        </button>
        {lead && (
          <button className="link-btn" onClick={onClear}>
            Entfernen
          </button>
        )}
      </div>
    </div>
  );
}

interface LeadPickerModalProps {
  leads: Lead[];
  currentId: number | null;
  onClose: () => void;
  onSelect: (id: number | null) => void;
  onCreated: (lead: Lead) => void;
}

function LeadPickerModal({
  leads,
  currentId,
  onClose,
  onSelect,
  onCreated,
}: LeadPickerModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3 style={{ margin: 0 }}>Lead auswählen</h3>
          <button className="link-btn" onClick={onClose}>
            Schließen
          </button>
        </div>
        <StepLead
          leads={leads}
          selected={currentId}
          onSelect={(id) => onSelect(id)}
          onCreated={onCreated}
        />
      </div>
    </div>
  );
}
