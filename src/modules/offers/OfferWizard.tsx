import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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
import { StepLead } from "./steps/StepLead";
import { StepParams } from "./steps/StepParams";
import { StepBlocks } from "./steps/StepBlocks";
import { StepReview } from "./steps/StepReview";

interface Props {
  profile: Profile;
  onCancel: () => void;
  onCreated: (offerId: number) => void;
}

const STEP_LABELS = [
  "1. Backtesting",
  "2. Lead",
  "3. Parameter",
  "4. Angebot",
  "5. Start",
];

export function OfferWizard({ onCancel, onCreated }: Props) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [backtestId, setBacktestId] = useState<number | null>(null);
  const [leadId, setLeadId] = useState<number | null>(null);
  const [params, setParams] = useState<OfferParams>({ vertragsmodell: "DA" });
  const [composition, setComposition] = useState<string[] | null>(null);
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
    queryFn: () => api.post<PrecheckOut>("/api/offers/precheck", { backtest_id: backtestId }),
    enabled: !!backtestId,
  });

  const blocks = useQuery<BlocksList>({
    queryKey: ["offer-blocks", precheck.data?.use_case],
    queryFn: () =>
      api.get<BlocksList>(`/api/offers/blocks?use_case=${precheck.data!.use_case}`),
    enabled: !!precheck.data,
  });

  const uploadMutation = useMutation<UploadResult, ApiError, File>({
    mutationFn: (file) => api.upload<UploadResult>("/api/offers/upload", file),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["backtests"] });
      setBacktestId(result.backtest.id);
    },
  });

  const createMutation = useMutation<OfferSummary, ApiError>({
    mutationFn: () =>
      api.post<OfferSummary>("/api/offers", {
        backtest_id: backtestId,
        lead_id: leadId,
        params,
        composition,
      }),
    onSuccess: (offer) => {
      queryClient.invalidateQueries({ queryKey: ["offers"] });
      onCreated(offer.id);
    },
    onError: (err) => setError(err.message),
  });

  const canNext = (() => {
    if (step === 0) return backtestId !== null && precheck.data !== undefined;
    if (step === 1) return true; // Lead ist optional
    if (step === 2) return true; // Parameter alle optional (Defaults aus Backend)
    if (step === 3) return blocks.data !== undefined;
    return true;
  })();

  const next = () => {
    setError(null);
    if (step === 3 && composition === null && blocks.data) {
      setComposition(blocks.data.default_composition);
    }
    if (step === 2 && precheck.data && !params.dienstleistungsentgelt_eur_per_mwh) {
      // Defaults aus Precheck übernehmen, wenn User nichts angepasst hat
      setParams((prev) => ({
        ...precheck.data!.default_params,
        vertragsmodell: prev.vertragsmodell ?? "DA",
        ...prev,
      }));
    }
    setStep((s) => Math.min(s + 1, 4));
  };
  const back = () => {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Neues Angebot</h2>
          <p>Backtesting hochladen oder wählen, Parameter bestätigen, Angebot zusammenstellen.</p>
        </div>
        <button className="link-btn" onClick={onCancel}>
          Abbrechen
        </button>
      </div>

      <div className="wizard-stepper">
        {STEP_LABELS.map((label, idx) => (
          <span key={label} className={`wizard-stepper__item ${idx === step ? "active" : idx < step ? "done" : ""}`}>
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
        {step === 1 && (
          <StepLead
            leads={leads.data ?? []}
            selected={leadId}
            onSelect={setLeadId}
            onCreated={(lead) => {
              queryClient.invalidateQueries({ queryKey: ["leads"] });
              setLeadId(lead.id);
            }}
          />
        )}
        {step === 2 && (
          <StepParams
            precheck={precheck.data}
            params={params}
            onChange={setParams}
          />
        )}
        {step === 3 && blocks.data && (
          <StepBlocks
            blocks={blocks.data}
            composition={composition ?? blocks.data.default_composition}
            onChange={setComposition}
          />
        )}
        {step === 4 && (
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
        {step < 4 && (
          <button className="primary-btn primary-btn--inline" onClick={next} disabled={!canNext}>
            Weiter →
          </button>
        )}
      </div>
    </div>
  );
}
