import { useState } from "react";

import { LiveAnalysis } from "./LiveAnalysis";
import { UploadAnalysis } from "./UploadAnalysis";

type Source = "catalog" | "upload";

export function BacktestingPage() {
  const [source, setSource] = useState<Source>("catalog");

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Backtesting</h2>
          <p>
            {source === "catalog"
              ? "Standard-Katalog live analysieren (SunSync-Backtestings + Compute-Pipeline)."
              : "Eigenes Backtesting hochladen und visualisieren — CSV oder XLSX aus SunSync/PFM."}
          </p>
        </div>
      </div>

      <div className="wizard-stepper" style={{ marginBottom: "1rem" }}>
        <button
          type="button"
          className={`wizard-stepper__item ${source === "catalog" ? "active" : ""}`}
          onClick={() => setSource("catalog")}
        >
          Standard-Katalog
        </button>
        <button
          type="button"
          className={`wizard-stepper__item ${source === "upload" ? "active" : ""}`}
          onClick={() => setSource("upload")}
        >
          Eigenes Backtesting
        </button>
      </div>

      {source === "catalog" ? <LiveAnalysis /> : <UploadAnalysis />}
    </div>
  );
}
