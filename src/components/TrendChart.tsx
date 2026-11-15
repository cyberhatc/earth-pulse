type TrendChartProps = {
  series: number[];
  period: [number, number];
  slopePerDecade: number;
  unit: string;
  significant: boolean;
  direction: "up" | "down" | "flat";
};

function formatTickValue(val: number): string {
  const abs = Math.abs(val);
  if (abs >= 1000) return Math.round(val).toLocaleString("en-US");
  if (abs >= 10) return val.toFixed(1);
  return val.toFixed(2);
}

export function TrendChart({
  series,
  period,
  slopePerDecade,
  unit,
  significant,
  direction,
}: TrendChartProps) {
  if (series.length === 0) {
    return null;
  }

  const W = 760;
  const H = 260;
  const padL = 48;
  const padR = 16;
  const padT = 16;
  const padB = 32;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  let min = series[0];
  let max = series[0];
  let sum = 0;
  for (let i = 0; i < series.length; i += 1) {
    const v = series[i];
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
  }

  const range = max - min || 1;
  const yMid = min + range / 2;

  const toX = (idx: number) =>
    series.length === 1
      ? padL + plotW / 2
      : padL + (idx / (series.length - 1)) * plotW;
  const toY = (val: number) => padT + (1 - (val - min) / range) * plotH;

  const rawPath = series
    .map(
      (val, idx) =>
        `${idx === 0 ? "M" : "L"}${toX(idx).toFixed(1)},${toY(val).toFixed(1)}`,
    )
    .join(" ");

  const xMean = (series.length - 1) / 2;
  const yMean = sum / series.length;
  const slopePerMonth = slopePerDecade / 120;
  const fitStart = yMean + slopePerMonth * (0 - xMean);
  const fitEnd = yMean + slopePerMonth * (series.length - 1 - xMean);

  const trendColor =
    direction === "up"
      ? "var(--trend-up)"
      : direction === "down"
        ? "var(--trend-down)"
        : "var(--trend-flat)";

  const yTicks = [max, yMid, min];
  const [startYear, endYear] = period;
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((frac) => ({
    x: padL + frac * plotW,
    label: Math.round(startYear + frac * (endYear - startYear)),
  }));

  return (
    <div className="trend-chart">
      <div className="trend-chart-frame">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="trend-chart-svg"
          role="img"
          aria-label={`Monthly series and fitted trend from ${startYear} to ${endYear}`}
        >
          {yTicks.map((tickVal, idx) => {
            const y = toY(tickVal);
            return (
              <g key={idx}>
                <line
                  x1={padL}
                  y1={y}
                  x2={W - padR}
                  y2={y}
                  stroke="var(--line)"
                  strokeWidth={1}
                  strokeDasharray="2 4"
                />
                <text
                  x={padL - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="chart-axis-label"
                >
                  {formatTickValue(tickVal)}
                </text>
              </g>
            );
          })}

          {xTicks.map((tick, idx) => (
            <text
              key={idx}
              x={tick.x}
              y={H - 10}
              textAnchor={
                idx === 0 ? "start" : idx === xTicks.length - 1 ? "end" : "middle"
              }
              className="chart-axis-label"
            >
              {tick.label}
            </text>
          ))}

          <path
            d={rawPath}
            fill="none"
            stroke="var(--ink-mute)"
            strokeWidth={1}
            opacity={0.55}
          />

          <line
            x1={toX(0)}
            y1={toY(fitStart)}
            x2={toX(series.length - 1)}
            y2={toY(fitEnd)}
            stroke={trendColor}
            strokeWidth={2}
            strokeDasharray={significant ? "0" : "6 4"}
          />
        </svg>
      </div>

      <div className="chart-legend">
        <div className="chart-legend-items">
          <span className="legend-item">
            <span className="legend-swatch legend-swatch-raw" aria-hidden="true" />
            <span>Monthly series</span>
          </span>
          <span className="legend-item">
            <span
              className={`legend-swatch ${significant ? "" : "legend-swatch-dashed"}`}
              style={{ borderColor: trendColor }}
              aria-hidden="true"
            />
            <span>
              Fitted trend ({significant ? "significant" : "not significant"})
            </span>
          </span>
        </div>
        <span className="chart-legend-unit">Units: {unit}</span>
      </div>
    </div>
  );
}
