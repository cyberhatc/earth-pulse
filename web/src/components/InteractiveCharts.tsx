import { useMemo, useState } from "react";
import type { PointerEvent } from "react";
import type { BackendForecast } from "../lib/api";
import type { AnomalyEvent, RegionFingerprint } from "../lib/types";
import { formatSignedNumber, formatP } from "../lib/trend";

const PARAM_META: Record<string, { label: string; unit: string }> = {
  temperature: { label: "Air temperature", unit: "°C" },
  precipitation: { label: "Precipitation", unit: "mm/month" },
  solar_radiation: { label: "Solar radiation", unit: "MJ/m²/day" },
  humidity: { label: "Relative humidity", unit: "%" },
  wind: { label: "Wind speed", unit: "m/s" },
  ndvi: { label: "Vegetation (NDVI)", unit: "index" },
  sst: { label: "Sea surface temperature", unit: "°C" },
  sea_level: { label: "Sea level", unit: "mm" },
};

function paramLabel(param: string): string {
  return PARAM_META[param]?.label ?? param.replace(/_/g, " ");
}

function paramUnitOf(param: string): string {
  return PARAM_META[param]?.unit ?? "units";
}

export function paramDisplay(param: string): { label: string; unit: string } {
  return { label: paramLabel(param), unit: paramUnitOf(param) };
}

function fmt(v: number, digits = 2): string {
  const abs = Math.abs(v);
  if (abs >= 1000) return Math.round(v).toLocaleString("en-US");
  if (abs >= 10) return v.toFixed(1);
  return v.toFixed(digits);
}

function movingAverage(series: number[], window = 12): number[] {
  const out: number[] = [];
  for (let i = 0; i < series.length; i += 1) {
    const from = Math.max(0, i - window + 1);
    let sum = 0;
    for (let j = from; j <= i; j += 1) sum += series[j];
    out.push(sum / (i - from + 1));
  }
  return out;
}

/* -------------------------------------------------- series explorer (hover) */
export function SeriesExplorer({
  seriesByParam,
  caseParam,
  period,
  slopePerDecade,
  fallbackSeries,
  fallbackParamLabel,
  unit,
  anomalyEvents,
  direction,
}: {
  seriesByParam: Record<string, (number | null)[]> | null;
  caseParam: string | null;
  period: [number, number];
  slopePerDecade: number;
  fallbackSeries: number[];
  fallbackParamLabel: string;
  unit: string;
  anomalyEvents: AnomalyEvent[];
  direction: "up" | "down" | "flat";
}) {
  const available = useMemo(() => {
    const keys = seriesByParam ? Object.keys(seriesByParam) : [];
    return keys.length ? keys : ["casefile"];
  }, [seriesByParam]);

  const [param, setParam] = useState<string>(() =>
    caseParam && available.includes(caseParam) ? caseParam : available[0],
  );
  const [smoothed, setSmoothed] = useState(false);
  const [showTrend, setShowTrend] = useState(true);
  const [hover, setHover] = useState<number | null>(null);

  const activeParam = available.includes(param) ? param : available[0];
  const isCase = activeParam === "casefile" || activeParam === caseParam;

  const rawPoints = useMemo(() => {
    if (activeParam === "casefile") return fallbackSeries;
    const series = seriesByParam?.[activeParam] ?? [];
    return series.map((v) => (v === null || v === undefined ? NaN : v));
  }, [activeParam, seriesByParam, fallbackSeries]);

  const label =
    activeParam === "casefile" ? fallbackParamLabel : paramLabel(activeParam);
  const activeUnit = activeParam === "casefile" ? unit : paramUnitOf(activeParam);

  const values = useMemo(
    () => rawPoints.filter((v) => Number.isFinite(v)) as number[],
    [rawPoints],
  );
  const display = useMemo(() => {
    if (!smoothed) return rawPoints;
    if (!values.length) return rawPoints;
    const filled = rawPoints.map((v) => (Number.isFinite(v) ? (v as number) : values[0]));
    return movingAverage(filled, 12);
  }, [rawPoints, smoothed, values]);

  const W = 860;
  const H = 280;
  const padL = 52;
  const padR = 14;
  const padT = 18;
  const padB = 34;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const stats = useMemo(() => {
    if (!values.length) return null;
    let min = values[0];
    let max = values[0];
    let sum = 0;
    for (const v of values) {
      if (v < min) min = v;
      if (v > max) max = v;
      sum += v;
    }
    const range = max - min || 1;
    const yMid = min + range / 2;
    return { min, max, yMid, range, mean: sum / values.length };
  }, [values]);

  if (!stats) {
    return <p className="report-empty">No usable series at this cell.</p>;
  }

  const toX = (i: number) =>
    padL + (i / Math.max(1, display.length - 1)) * plotW;
  const toY = (v: number) =>
    padT + (1 - (v - stats.min) / stats.range) * plotH;

  const path = display
    .map((v, i) =>
      Number.isFinite(v)
        ? `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(v as number).toFixed(1)}`
        : "",
    )
    .filter(Boolean)
    .join(" ");

  const [startYear, endYear] = period;
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((frac) => ({
    x: padL + frac * plotW,
    label: Math.round(startYear + frac * (endYear - startYear)),
  }));

  const idxFromEvent = (e: PointerEvent<SVGRectElement>) => {
    const rect = (e.currentTarget as SVGRectElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const frac = (x - padL * (rect.width / W)) / (plotW * (rect.width / W));
    const idx = Math.round(frac * (display.length - 1));
    return Math.max(0, Math.min(display.length - 1, idx));
  };

  const trendColor =
    direction === "up"
      ? "var(--trend-up)"
      : direction === "down"
        ? "var(--trend-down)"
        : "var(--trend-flat)";

  const trendY = (frac: number) => {
    const slopePerMonth = slopePerDecade / 120;
    const meanIdx = (display.length - 1) / 2;
    return stats.mean + slopePerMonth * (frac * (display.length - 1) - meanIdx);
  };

  // Anomaly indexes (case-file variable only)
  const anomalyIdx = new Set(anomalyEvents.map((ev) => ev.index));
  const anomalous = isCase
    ? display
        .map((v, i) => (anomalyIdx.has(i) ? i : -1))
        .filter((i) => i >= 0)
    : [];

  const hoverVal = hover !== null ? display[hover] : null;

  return (
    <div className="series-explorer">
      <div className="series-controls">
        <div className="param-chips" role="tablist" aria-label="Parameter">
          {available.map((p) => (
            <button
              key={p}
              role="tab"
              aria-selected={p === activeParam}
              className={`param-chip${p === activeParam ? " param-chip-active" : ""}`}
              onClick={() => setParam(p)}
              type="button"
            >
              {p === "casefile" ? fallbackParamLabel : paramLabel(p)}
            </button>
          ))}
        </div>
        <div className="series-toggles">
          <button
            type="button"
            className={`toggle-chip${smoothed ? " toggle-chip-on" : ""}`}
            onClick={() => setSmoothed((v) => !v)}
            aria-pressed={smoothed}
          >
            12-mo average
          </button>
          {isCase ? (
            <button
              type="button"
              className={`toggle-chip${showTrend ? " toggle-chip-on" : ""}`}
              onClick={() => setShowTrend((v) => !v)}
              aria-pressed={showTrend}
            >
              Trend line
            </button>
          ) : null}
        </div>
      </div>

      <div className="series-frame">
        <svg viewBox={`0 0 ${W} ${H}`} className="series-svg" role="img"
             aria-label={`${label} monthly series from ${startYear} to ${endYear}`}>
          {[stats.max, stats.yMid, stats.min].map((tickVal, idx) => (
            <g key={idx}>
              <line x1={padL} x2={W - padR} y1={toY(tickVal)} y2={toY(tickVal)}
                    stroke="var(--line)" strokeWidth={1} strokeDasharray="2 4" />
              <text x={padL - 8} y={toY(tickVal) + 3} textAnchor="end"
                    className="chart-axis-label">{fmt(tickVal)}</text>
            </g>
          ))}
          {xTicks.map((tick, idx) => (
            <text key={idx} x={tick.x} y={H - 12} className="chart-axis-label"
                  textAnchor={idx === 0 ? "start" : idx === xTicks.length - 1 ? "end" : "middle"}>
              {tick.label}
            </text>
          ))}

          <path d={path} fill="none" stroke="var(--ink-mute)" strokeWidth={1.1} opacity={0.65} />

          {isCase && showTrend ? (
            <line x1={toX(0)} y1={toY(trendY(0))} x2={toX(display.length - 1)} y2={toY(trendY(1))}
                  stroke={trendColor} strokeWidth={2} />
          ) : null}

          {anomalous.map((i) => (
            <circle key={i} cx={toX(i)} cy={toY(display[i] as number)} r={3.4}
                    fill="var(--warn, #d9a05b)" stroke="var(--paper)" strokeWidth={1} />
          ))}

          {hover !== null && Number.isFinite(display[hover]) ? (
            <g>
              <line x1={toX(hover)} x2={toX(hover)} y1={padT} y2={H - padB}
                    stroke="var(--accent)" strokeWidth={1} strokeDasharray="3 3" />
              <circle cx={toX(hover)} cy={toY(display[hover] as number)} r={4}
                      fill="var(--accent)" />
            </g>
          ) : null}

          <rect x={padL} y={padT} width={plotW} height={plotH} fill="transparent"
                onPointerMove={(e) => setHover(idxFromEvent(e))}
                onPointerLeave={() => setHover(null)} />
        </svg>

        {hover !== null && hoverVal !== null && Number.isFinite(hoverVal as number) ? (
          <div className="series-tooltip" role="status">
            <strong>{label}</strong>
            <span>{startYear + Math.floor((hover / Math.max(1, display.length - 1)) * (endYear - startYear))} · {fmt(hoverVal as number, 3)} {activeUnit}</span>
          </div>
        ) : null}
      </div>

      <div className="chart-legend">
        <div className="chart-legend-items">
          <span className="legend-item">
            <span className="legend-swatch legend-swatch-raw" aria-hidden="true" />
            <span>{smoothed ? "12-mo average" : "Monthly series"}</span>
          </span>
          {isCase && showTrend ? (
            <span className="legend-item">
              <span className="legend-swatch" style={{ borderColor: trendColor }} aria-hidden="true" />
              <span>Fitted trend</span>
            </span>
          ) : null}
          {anomalous.length > 0 ? (
            <span className="legend-item">
              <span className="anomaly-dot-legend" aria-hidden="true" />
              <span>{anomalous.length} anomal{anomalous.length === 1 ? "y" : "ies"}</span>
            </span>
          ) : null}
        </div>
        <span className="chart-legend-unit">Units: {activeUnit}</span>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- forecast ribbon */
export function ForecastRibbon({
  forecast,
  param,
  unit,
}: {
  forecast: BackendForecast | null;
  param: string | null;
  unit: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const block =
    forecast && param ? forecast.timeseries[param] : undefined;
  const dates = forecast?.dates ?? [];
  const n = block?.mean.length ?? 0;

  if (!forecast || !block || n === 0) {
    return <p className="report-empty">Forecast unavailable at this cell — the backend is offline or the artifact did not load.</p>;
  }

  const W = 860;
  const H = 240;
  const padL = 52;
  const padR = 14;
  const padT = 18;
  const padB = 30;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const mean = block.mean;
  const lower = block.lower;
  const upper = block.upper;
  let min = lower[0];
  let max = upper[0];
  for (let i = 0; i < n; i += 1) {
    if (lower[i] < min) min = lower[i];
    if (upper[i] > max) max = upper[i];
  }
  const range = max - min || 1;

  const toX = (i: number) => padL + (i / Math.max(1, n - 1)) * plotW;
  const toY = (v: number) => padT + (1 - (v - min) / range) * plotH;

  const meanPath = mean.map((v, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(" ");
  const band = [
    ...upper.map((v, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`),
    ...lower.slice().reverse().map((v, i) => `L${toX(n - 1 - i).toFixed(1)},${toY(v).toFixed(1)}`),
    "Z",
  ].join(" ");

  const backtest = forecast.backtest?.per_parameter?.[param ?? ""];
  const delta = mean[n - 1] - mean[0];

  const idxFromEvent = (e: PointerEvent<SVGRectElement>) => {
    const rect = (e.currentTarget as SVGRectElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const frac = (x - padL * (rect.width / W)) / (plotW * (rect.width / W));
    const idx = Math.round(frac * (n - 1));
    return Math.max(0, Math.min(n - 1, idx));
  };

  const hoverInfo = hover !== null ? { date: dates[hover], mean: mean[hover], lower: lower[hover], upper: upper[hover] } : null;

  return (
    <div className="forecast-ribbon">
      <div className="forecast-headline">
        <span className="forecast-delta">
          Net change over horizon: {delta >= 0 ? "+" : ""}{delta.toFixed(3)} {unit}
        </span>
        <span className="forecast-note">
          {forecast.model} · {forecast.horizon_months} months · {dates[0]} → {dates[dates.length - 1]}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="series-svg" role="img"
           aria-label="Forecast with p10–p90 uncertainty band">
        {[min, min + range / 2, max].map((tickVal, idx) => (
          <g key={idx}>
            <line x1={padL} x2={W - padR} y1={toY(tickVal)} y2={toY(tickVal)}
                  stroke="var(--line)" strokeWidth={1} strokeDasharray="2 4" />
            <text x={padL - 8} y={toY(tickVal) + 3} textAnchor="end"
                  className="chart-axis-label">{fmt(tickVal)}</text>
          </g>
        ))}
        <path d={band} fill="var(--accent-soft, #e2eeed)" opacity={0.28} />
        <path d={meanPath} fill="none" stroke="var(--accent)" strokeWidth={2} />
        {hoverInfo ? (
          <g>
            <line x1={toX(hover as number)} x2={toX(hover as number)} y1={padT} y2={H - padB}
                  stroke="var(--accent)" strokeWidth={1} strokeDasharray="3 3" />
            <circle cx={toX(hover as number)} cy={toY(mean[hover as number])} r={4}
                    fill="var(--accent)" />
          </g>
        ) : null}
        <rect x={padL} y={padT} width={plotW} height={plotH} fill="transparent"
              onPointerMove={(e) => setHover(idxFromEvent(e))}
              onPointerLeave={() => setHover(null)} />
      </svg>
      {hoverInfo ? (
        <div className="series-tooltip forecast-tooltip" role="status">
          <strong>{hoverInfo.date}</strong>
          <span>p50 {fmt(hoverInfo.mean, 3)} {unit} · p10–p90 {fmt(hoverInfo.lower, 2)}–{fmt(hoverInfo.upper, 2)}</span>
        </div>
      ) : null}
      <p className="forecast-caption">
        Probabilistic p10–p90 bands — not a certain future.
        {backtest ? ` Backtest for ${paramLabel(param ?? "")}: PICP ${backtest.picp_p10_p90?.toFixed(2)}, MAE ${backtest.mae?.toFixed(2)} ${paramUnitOf(param ?? "")}.` : ""}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------- backtest bars */
export function BacktestBars({
  forecast,
}: {
  forecast: BackendForecast | null;
}) {
  const per = forecast?.backtest?.per_parameter ?? null;
  if (!per || Object.keys(per).length === 0) {
    return <p className="report-empty">Backtest unavailable — start the live backend to compute it.</p>;
  }
  const entries = Object.entries(per);
  const maxPicp = Math.max(1, ...entries.map(([, b]) => b.picp_p10_p90));
  return (
    <div className="backtest-bars">
      {entries.map(([param, bt]) => {
        const width = Math.min(100, (bt.picp_p10_p90 / maxPicp) * 100);
        const good = bt.picp_p10_p90 >= 0.75;
        return (
          <div key={param} className="backtest-row">
            <span className="backtest-label">{paramLabel(param)}</span>
            <div className="backtest-track" aria-hidden="true">
              <span className={`backtest-fill${good ? "" : " backtest-fill-warn"}`}
                    style={{ width: `${width.toFixed(1)}%` }} />
              <span className="backtest-target" title="80% calibrated band target" />
            </div>
            <span className="backtest-values">
              PICP {bt.picp_p10_p90?.toFixed(2)} · MAE {bt.mae?.toFixed(2)} · RMSE {bt.rmse?.toFixed(2)}
            </span>
          </div>
        );
      })}
      <p className="backtest-caption">
        Rolling-origin backtest (12-month horizon). PICP = fraction of time the true
        value fell inside the p10–p90 band; ≈0.80 is the calibration target.
      </p>
    </div>
  );
}

/* --------------------------------------------------------- fingerprint bars */
export function FingerprintBars({
  fingerprint,
}: {
  fingerprint: RegionFingerprint;
}) {
  const dims = [...fingerprint.dimensions].sort(
    (a, b) => Math.abs(b.slope) - Math.abs(a.slope),
  );
  const maxAbs = Math.max(...dims.map((d) => Math.abs(d.slope)), 1e-6);
  return (
    <div className="fingerprint-bars">
      {dims.map((d) => {
        const pct = (Math.abs(d.slope) / maxAbs) * 50;
        const side = d.slope >= 0 ? "pos" : "neg";
        return (
          <div key={d.key} className="fp-row">
            <span className="fp-label">{d.shortLabel}</span>
            <div className="fp-track" role="presentation">
              <span className="fp-zero" aria-hidden="true" />
              <span
                className={`fp-bar fp-bar-${side}${d.significant ? "" : " fp-bar-ns"}`}
                style={{ width: `${pct.toFixed(1)}%` }}
              />
            </div>
            <span className="fp-value">
              {formatSignedNumber(d.slope)} {d.slopeUnit} · {formatP(d.pValue)}
              {d.significant ? " · sig" : ""}
            </span>
          </div>
        );
      })}
      <p className="fp-caption">
        {fingerprint.significantCount}/{fingerprint.dimensions.length} indicators significant · {fingerprint.coupledInsight}
      </p>
    </div>
  );
}

/* --------------------------------------------------------------- coverage */
export function CoverageGrid({
  trends,
  used,
  unavailable,
  totalMonths,
}: {
  trends: Record<string, { n: number }> | null;
  used: string[];
  unavailable: string[];
  totalMonths: number | null;
}) {
  const params = [...used, ...unavailable];
  if (params.length === 0) {
    return <p className="report-empty">No coverage information — backend offline.</p>;
  }
  return (
    <div className="coverage-grid">
      {params.map((param) => {
        const rec = trends?.[param];
        const n = rec?.n ?? 0;
        const total = totalMonths ?? n;
        const pct = used.includes(param) && total > 0 ? (n / total) * 100 : 0;
        const unavailableParam = unavailable.includes(param);
        return (
          <div key={param} className="coverage-row">
            <span className="coverage-label">{paramLabel(param)}</span>
            <div className="coverage-track" aria-hidden="true">
              <span
                className={`coverage-fill${unavailableParam ? " coverage-fill-none" : ""}`}
                style={{ width: `${unavailableParam ? 0 : pct.toFixed(1)}%` }}
              />
            </div>
            <span className="coverage-value">
              {unavailableParam ? "No coverage" : `${n}/${total} mo`}
            </span>
          </div>
        );
      })}
    </div>
  );
}
