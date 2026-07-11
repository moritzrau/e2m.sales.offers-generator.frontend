import { useRef, useState } from "react";

import type { Backtest, PrecheckOut } from "../../../api/types";
import { formatDateTime } from "../format";

interface Props {
  backtests: Backtest[];
  uploading: boolean;
  uploadError: string | undefined;
  onUpload: (file: File) => void;
  selected: number | null;
  onSelect: (id: number) => void;
  precheck: PrecheckOut | undefined;
  precheckLoading: boolean;
  precheckError: string | undefined;
}

const USE_CASE_LABEL: Record<string, string> = {
  colocation_green: "Co-Location Grün",
  colocation_grey: "Co-Location Grau",
  standalone_bess: "Standalone BESS",
};

export function StepBacktesting({
  backtests,
  uploading,
  uploadError,
  onUpload,
  selected,
  onSelect,
  precheck,
  precheckLoading,
  precheckError,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    onUpload(files[0]);
  };

  return (
    <div className="wizard-step">
      <h3>1. Backtesting wählen</h3>
      <p className="muted">CSV oder XLSX aus SunSync. Der Typ (Grün/Grau/Standalone) wird automatisch erkannt.</p>

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
        {uploading ? (
          <span>Lade hoch …</span>
        ) : (
          <>
            <span className="dropzone__hint">Datei hierhin ziehen oder klicken zum Auswählen</span>
            <span className="muted">.csv oder .xlsx</span>
          </>
        )}
      </div>
      {uploadError && <div className="error-banner">{uploadError}</div>}

      {backtests.length > 0 && (
        <>
          <h4 style={{ marginTop: "1.5rem" }}>Bereits hochgeladen</h4>
          <ul className="backtest-list">
            {backtests.map((bt) => (
              <li key={bt.id}>
                <label className="backtest-list__item">
                  <input
                    type="radio"
                    checked={selected === bt.id}
                    onChange={() => onSelect(bt.id)}
                  />
                  <span className="backtest-list__file">{bt.original_filename}</span>
                  <span className="badge">{bt.backtest_type ?? "unbekannt"}</span>
                  <span className="muted">{formatDateTime(bt.created_at)}</span>
                </label>
              </li>
            ))}
          </ul>
        </>
      )}

      {selected !== null && (
        <div className="precheck-box">
          {precheckLoading && <p className="muted">Erkenne Typ und lade Defaults …</p>}
          {precheckError && <div className="error-banner">{precheckError}</div>}
          {precheck && (
            <>
              <p>
                <strong>Erkannter Typ:</strong> {precheck.backtest_type} —{" "}
                <em>{USE_CASE_LABEL[precheck.use_case] ?? precheck.use_case}</em>
              </p>
              <p className="muted">
                Default-Komposition: {precheck.default_composition.length} Folien.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
