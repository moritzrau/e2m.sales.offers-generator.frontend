import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, ApiError } from "../../api/client";
import type { BacktestingUploadListItem } from "../../api/types";
import { formatDateTime } from "../offers/format";

export type CustomAnalyzeUseCase =
  | "colocation_green"
  | "colocation_grey"
  | "standalone_bess";

const USE_CASE_OPTIONS: { value: CustomAnalyzeUseCase; label: string }[] = [
  { value: "colocation_green", label: "Co-Location Grün" },
  { value: "colocation_grey", label: "Co-Location Grau" },
  { value: "standalone_bess", label: "Standalone BESS" },
];

const UPLOAD_FEATURE_HINTS = [
  "PFM-basierter FCR/aFRR-Split nur im Standard-Katalog verfügbar",
  "Depth-Scaling (2h → 3/4h) nur im Standard-Katalog verfügbar",
];

interface UploadMetaForm {
  label: string;
  ref_pv_mw: string;
  ref_bess_mw: string;
  ref_bess_mwh: string;
}

const EMPTY_META: UploadMetaForm = {
  label: "",
  ref_pv_mw: "",
  ref_bess_mw: "",
  ref_bess_mwh: "",
};

function UploadMetaFields({
  useCase,
  meta,
  onChange,
}: {
  useCase: string | null;
  meta: UploadMetaForm;
  onChange: (next: UploadMetaForm) => void;
}) {
  const isStandalone = useCase === "standalone_bess";
  const isColocation = useCase === "colocation_green" || useCase === "colocation_grey";

  return (
    <div className="profile-form">
      <label style={{ gridColumn: "1 / -1" }}>
        Bezeichnung — optional
        <input
          type="text"
          value={meta.label}
          onChange={(e) => onChange({ ...meta, label: e.target.value })}
          placeholder="z. B. Projekt Müller, Stand 03/2026"
        />
      </label>
      {isColocation && (
        <label>
          Referenz PV (MW)
          <input
            type="text"
            inputMode="decimal"
            value={meta.ref_pv_mw}
            onChange={(e) => onChange({ ...meta, ref_pv_mw: e.target.value })}
          />
        </label>
      )}
      <label>
        Referenz BESS (MW)
        <input
          type="text"
          inputMode="decimal"
          value={meta.ref_bess_mw}
          onChange={(e) => onChange({ ...meta, ref_bess_mw: e.target.value })}
        />
      </label>
      <label>
        Referenz BESS (MWh)
        <input
          type="text"
          inputMode="decimal"
          value={meta.ref_bess_mwh}
          onChange={(e) => onChange({ ...meta, ref_bess_mwh: e.target.value })}
        />
      </label>
      {!useCase && (
        <p className="profile-form-hint" style={{ gridColumn: "1 / -1", margin: 0 }}>
          Referenzgrößen können auch nach dem Upload ergänzt werden, sobald der Use Case erkannt
          ist.
        </p>
      )}
      {isStandalone && (
        <p className="profile-form-hint" style={{ gridColumn: "1 / -1", margin: 0 }}>
          Standalone: Referenz BESS (MW) und BESS (MWh) sind für Skalierung und Zyklen erforderlich.
        </p>
      )}
    </div>
  );
}

function UploadDialog({
  onClose,
  onUploaded,
}: {
  onClose: () => void;
  onUploaded: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [meta, setMeta] = useState<UploadMetaForm>(EMPTY_META);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = useMutation<BacktestingUploadListItem, ApiError, void>({
    mutationFn: async () => {
      if (!file) throw new ApiError(400, "Bitte zuerst eine CSV-/XLSX-Datei wählen.");
      return api.upload<BacktestingUploadListItem>("/api/backtesting/uploads", file, {
        label: meta.label || undefined,
        ref_pv_mw: meta.ref_pv_mw || undefined,
        ref_bess_mw: meta.ref_bess_mw || undefined,
        ref_bess_mwh: meta.ref_bess_mwh || undefined,
      });
    },
    onSuccess: () => {
      onUploaded();
      onClose();
    },
    onError: (err) => setError(err.message),
  });

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setFile(files[0]);
    setError(null);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3 style={{ margin: 0 }}>Backtesting hochladen</h3>
          <button type="button" className="link-btn" onClick={onClose}>
            Schließen
          </button>
        </div>
        <p className="muted" style={{ marginTop: 0 }}>
          CSV oder XLSX aus SunSync / PFM. Der Use Case wird automatisch erkannt.
        </p>
        <div
          className={`dropzone ${dragOver ? "dropzone--over" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFiles(e.dataTransfer.files);
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx"
            hidden
            onChange={(e) => handleFiles(e.target.files)}
          />
          {upload.isPending ? (
            <span>Lade hoch …</span>
          ) : file ? (
            <>
              <span className="dropzone__hint">{file.name}</span>
              <span className="muted">Klicken zum Ersetzen</span>
            </>
          ) : (
            <>
              <span className="dropzone__hint">Datei hierhin ziehen oder klicken</span>
              <span className="muted">.csv oder .xlsx</span>
            </>
          )}
        </div>
        <h4 style={{ marginTop: "1rem", marginBottom: "0.35rem" }}>Referenzgrößen</h4>
        <UploadMetaFields useCase={null} meta={meta} onChange={setMeta} />
        {error && <div className="error-banner">{error}</div>}
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.85rem" }}>
          <button
            type="button"
            className="primary-btn primary-btn--inline"
            disabled={!file || upload.isPending}
            onClick={() => upload.mutate()}
          >
            {upload.isPending ? "Lade hoch …" : "Hochladen"}
          </button>
          <button type="button" className="link-btn" onClick={onClose} disabled={upload.isPending}>
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}

function UploadMetaPatch({
  item,
  onSaved,
}: {
  item: BacktestingUploadListItem;
  onSaved: () => void;
}) {
  const [meta, setMeta] = useState<UploadMetaForm>({
    label: item.label,
    ref_pv_mw: item.ref_pv_mw != null ? String(item.ref_pv_mw) : "",
    ref_bess_mw: item.ref_bess_mw != null ? String(item.ref_bess_mw) : "",
    ref_bess_mwh: item.ref_bess_mwh != null ? String(item.ref_bess_mwh) : "",
  });
  const [error, setError] = useState<string | null>(null);

  const save = useMutation<BacktestingUploadListItem, ApiError, void>({
    mutationFn: async () =>
      api.put<BacktestingUploadListItem>(`/api/backtesting/uploads/${item.id}`, {
        label: meta.label || undefined,
        ref_pv_mw: meta.ref_pv_mw || undefined,
        ref_bess_mw: meta.ref_bess_mw || undefined,
        ref_bess_mwh: meta.ref_bess_mwh || undefined,
      }),
    onSuccess: () => {
      setError(null);
      onSaved();
    },
    onError: (err) => setError(err.message),
  });

  return (
    <div style={{ marginTop: "0.5rem", padding: "0.65rem 0.75rem", background: "var(--color-primary-soft)", borderRadius: 10 }}>
      <p style={{ margin: "0 0 0.5rem", fontSize: "0.82rem", fontWeight: 600 }}>
        Referenzgrößen ergänzen
      </p>
      <UploadMetaFields useCase={item.use_case} meta={meta} onChange={setMeta} />
      {error && <div className="error-banner">{error}</div>}
      <button
        type="button"
        className="primary-btn primary-btn--inline"
        style={{ marginTop: "0.5rem" }}
        disabled={save.isPending}
        onClick={() => save.mutate()}
      >
        {save.isPending ? "Speichere …" : "Speichern"}
      </button>
    </div>
  );
}

export function UploadPanel({
  selectedUploadId,
  onUploadSelect,
}: {
  selectedUploadId?: number | null;
  onUploadSelect?: (id: number | null) => void;
}) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const uploads = useQuery<BacktestingUploadListItem[]>({
    queryKey: ["backtesting-uploads"],
    queryFn: () => api.get<BacktestingUploadListItem[]>("/api/backtesting/uploads"),
    retry: false,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["backtesting-uploads"] });
  };

  const useCaseLabel = (uc: string | null) =>
    USE_CASE_OPTIONS.find((o) => o.value === uc)?.label ?? uc ?? "unbekannt";

  return (
    <>
      <div className="card" style={{ marginTop: "0.75rem" }}>
        <h3 style={{ marginTop: 0 }}>Eigene Backtestings</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.85rem" }}>
          {UPLOAD_FEATURE_HINTS.map((hint) => (
            <span key={hint} className="badge badge--muted" title={hint}>
              {hint}
            </span>
          ))}
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.75rem" }}>
          <button
            type="button"
            className="primary-btn primary-btn--inline"
            onClick={() => setDialogOpen(true)}
          >
            Backtesting hochladen
          </button>
        </div>
        {uploads.isLoading && <p className="muted">Lade Liste …</p>}
        {uploads.isError && (
          <div className="error-banner">
            {(uploads.error as ApiError | undefined)?.message ?? "Upload-Liste nicht ladbar."}
          </div>
        )}
        {uploads.data && uploads.data.length === 0 && (
          <p className="muted" style={{ margin: 0 }}>
            Noch keine eigenen Backtestings gespeichert.
          </p>
        )}
        {uploads.data && uploads.data.length > 0 && (
          <ul className="backtest-list">
            {uploads.data.map((item) => (
              <li key={item.id}>
                <label className="backtest-list__item">
                  <input
                    type="radio"
                    name="backtesting-upload"
                    checked={selectedUploadId === item.id}
                    onChange={() => onUploadSelect?.(item.id)}
                  />
                  <span className="backtest-list__file">
                    {item.label || item.original_filename}
                  </span>
                  <span className="badge">{useCaseLabel(item.use_case)}</span>
                  {item.needs_meta && <span className="badge badge--pending">Meta fehlt</span>}
                  <span className="muted">{formatDateTime(item.created_at)}</span>
                </label>
                {item.needs_meta && <UploadMetaPatch item={item} onSaved={refresh} />}
              </li>
            ))}
          </ul>
        )}
      </div>
      {dialogOpen && <UploadDialog onClose={() => setDialogOpen(false)} onUploaded={refresh} />}
    </>
  );
}
