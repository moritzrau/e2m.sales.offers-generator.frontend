import { LiveAnalysis } from "./LiveAnalysis";

export function BacktestingPage() {
  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Backtesting</h2>
          <p>
            Live-Auswertung skalierter SunSync-Backtestings (Katalog + Compute-Pipeline).
            Eigene Backtestings können im Angebotstool hochgeladen werden.
          </p>
        </div>
      </div>

      <LiveAnalysis />
    </div>
  );
}
