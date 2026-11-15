type SparklineProps = {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
};

export function Sparkline({
  values,
  width = 120,
  height = 32,
  color = "var(--accent)",
  className,
}: SparklineProps) {
  if (values.length === 0) {
    return null;
  }

  let min = values[0];
  let max = values[0];
  for (let i = 1; i < values.length; i += 1) {
    if (values[i] < min) min = values[i];
    if (values[i] > max) max = values[i];
  }

  const range = max - min || 1;
  const pad = 2;
  const innerW = Math.max(1, width - pad * 2);
  const innerH = Math.max(1, height - pad * 2);

  const points = values
    .map((val, idx) => {
      const x =
        values.length === 1
          ? pad + innerW / 2
          : pad + (idx / (values.length - 1)) * innerW;
      const y = pad + (1 - (val - min) / range) * innerH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      aria-hidden="true"
    >
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}
