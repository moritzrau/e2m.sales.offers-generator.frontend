/** Platzhalter waehrend der Analyse — die Pipeline braucht mehrere Sekunden. */
export function ResultSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Analyse läuft …</span>
      <div className="bt-hero">
        <div className="bt-skel bt-skel--line" style={{ width: 120, height: 9 }} />
        <div className="bt-skel bt-skel--value" />
        <div className="bt-skel bt-skel--line" style={{ width: "45%" }} />
        <div className="bt-skel" style={{ height: 12, borderRadius: 4, marginTop: "1.25rem" }} />
      </div>
      <div className="bt-tabs" style={{ borderBottomColor: "transparent" }}>
        <div className="bt-skel bt-skel--line" style={{ width: 320, height: 14 }} />
      </div>
      <div className="bt-grid-2">
        <div className="bt-card">
          <div className="bt-skel bt-skel--line" style={{ width: "40%" }} />
          <div className="bt-skel bt-skel--chart" />
        </div>
        <div className="bt-card">
          <div className="bt-skel bt-skel--line" style={{ width: "40%" }} />
          <div className="bt-skel bt-skel--chart" />
        </div>
      </div>
    </div>
  );
}

export function ChartSkeleton({ height = 300 }: { height?: number }) {
  return <div className="bt-skel" style={{ height }} aria-hidden="true" />;
}
