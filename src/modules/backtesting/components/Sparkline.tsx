interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  fill?: string;
  /** Index, der als Punkt hervorgehoben wird (Standard: hoechster Wert). */
  markIndex?: number;
  ariaLabel?: string;
}

/**
 * Winzige Verlaufslinie fuer Kennzahl-Kacheln und den Hero.
 * Bewusst ohne Chart-Bibliothek — 12 Punkte brauchen kein ECharts.
 */
export function Sparkline({
  values,
  width = 132,
  height = 40,
  color = "#001A70",
  fill = "rgba(16, 87, 200, 0.14)",
  markIndex,
  ariaLabel,
}: SparklineProps) {
  const clean = values.filter((v) => Number.isFinite(v));
  if (clean.length < 2) return null;

  const pad = 3;
  const min = Math.min(...clean, 0);
  const max = Math.max(...clean);
  const span = max - min || 1;
  const stepX = (width - pad * 2) / (clean.length - 1);

  const points = clean.map((v, i) => {
    const x = pad + i * stepX;
    const y = height - pad - ((v - min) / span) * (height - pad * 2);
    return [x, y] as const;
  });

  const line = points.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${points[points.length - 1][0].toFixed(1)} ${height - pad} L${points[0][0].toFixed(1)} ${height - pad} Z`;

  const mark = markIndex ?? clean.indexOf(max);
  const markPoint = points[mark];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role={ariaLabel ? "img" : "presentation"}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
    >
      <path d={area} fill={fill} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
      {markPoint && <circle cx={markPoint[0]} cy={markPoint[1]} r={2.8} fill="#FE5716" />}
    </svg>
  );
}
