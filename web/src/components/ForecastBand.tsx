export function yearOf(date: string | undefined): string {
  return date ? date.slice(0, 4) : "";
}

export function ForecastBand({
  dates,
  lower,
  upper,
  mean,
  unit,
}: {
  dates: string[];
  lower: number[];
  upper: number[];
  mean: number[];
  unit: string;
}) {
  const n = Math.min(dates.length, mean.length, lower.length, upper.length);
  if (n < 3) return null;

  const W = 760;
  const H = 240;
  const padL = 48;
  const padR = 14;
  const padT = 14;
  const padB = 30;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < n; i += 1) {
    for (const v of [lower[i], upper[i], mean[i]]) {
      if (!Number.isFinite(v)) continue;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  const range = max - min || 1;

  const x = (i: number) => padL + (i / (n - 1)) * plotW;
  const y = (v: number) => padT + (1 - (v - min) / range) * plotH;

  const bandUp = upper
    .slice(0, n)
    .map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
    .join(" ");
  const bandDown = lower
    .slice(0, n)
    .map((v, i) => ({ v, i }))
    .reverse()
    .map(({ v, i }) => `L${x(i).toFixed(1)},${y(v).toFixed(1)}`)
    .join(" ");
  const bandPath = `${bandUp} ${bandDown} Z`;
  const meanPath = mean
    .slice(0, n)
    .map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
    .join(" ");

  const ticks = [0, Math.floor((n - 1) / 2), n - 1];

  return (
    <div className="trend-chart">
      <div className="trend-chart-frame">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="trend-chart-svg"
          role="img"
          aria-label={`Projected ${unit} with p10-p90 band`}
        >
          {[max, (max + min) / 2, min].map((v, i) => (
            <g key={`y${i}`}>
              <line
                x1={padL}
                y1={y(v)}
                x2={W - padR}
                y2={y(v)}
                stroke="var(--line)"
                strokeWidth={1}
                strokeDasharray="2 4"
              />
              <text x={padL - 8} y={y(v) + 3} textAnchor="end" className="chart-axis-label">
                {Math.abs(v) >= 100 ? Math.round(v) : v.toFixed(2)}
              </text>
            </g>
          ))}
          {ticks.map((i, idx) => (
            <text
              key={`x${idx}`}
              x={x(i)}
              y={H - 10}
              textAnchor={idx === 0 ? "start" : idx === ticks.length - 1 ? "end" : "middle"}
              className="chart-axis-label"
            >
              {yearOf(dates[i])}
            </text>
          ))}
          <path d={bandPath} fill="var(--accent)" opacity={0.14} stroke="none" />
          <path d={meanPath} fill="none" stroke="var(--accent)" strokeWidth={2} />
        </svg>
      </div>
      <div className="chart-legend">
        <div className="chart-legend-items">
          <span className="legend-item">
            <span className="legend-swatch" style={{ background: "var(--accent)" }} aria-hidden="true" />
            <span>Projected median (p50)</span>
          </span>
          <span className="legend-item">
            <span
              className="legend-swatch"
              style={{ background: "var(--accent)", opacity: 0.25 }}
              aria-hidden="true"
            />
            <span>p10–p90 band</span>
          </span>
        </div>
        <span className="chart-legend-note">
          Statistical projection, not an observation
        </span>
      </div>
    </div>
  );
}
