// Mini-courbe SVG légère (pas de dépendance) tracée depuis une série de valeurs.
export function SparklineChart({
  values,
  height = 56,
  stroke = "#16C784",
}: {
  values: number[];
  height?: number;
  stroke?: string;
}) {
  if (values.length === 0) return null;
  const width = 300; // viewBox virtuel, le SVG est étiré en pleine largeur
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = values.length > 1 ? width / (values.length - 1) : 0;
  const pad = 4;
  const usable = height - pad * 2;
  const pts = values.map((v, i) => {
    const x = values.length === 1 ? width / 2 : i * stepX;
    const y = pad + usable - ((v - min) / span) * usable;
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${height} L${pts[0][0].toFixed(1)},${height} Z`;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height }}
      aria-hidden
    >
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#spark-fill)" />
      <path d={line} fill="none" stroke={stroke} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      {pts.length === 1 && <circle cx={pts[0][0]} cy={pts[0][1]} r="3" fill={stroke} />}
    </svg>
  );
}
