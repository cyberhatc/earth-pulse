import { getVariable } from "./data";
import type {
  AnomalyReport,
  EvidenceRecord,
  Region,
  RegionFingerprint,
  TrendStats,
} from "./types";
import {
  formatP,
  formatSignedNumber,
  formatSlope,
} from "./trend";

const PARAM_UNITS: Record<string, string> = {
  temperature: "°C",
  precipitation: "mm/month",
  ndvi: "index",
  sst: "°C",
  sea_level: "mm",
  solar_radiation: "MJ/m²/day",
  humidity: "%",
  wind: "m/s",
  clear_sky_solar_radiation: "MJ/m²/day",
  dew_point: "°C",
  skin_temperature: "°C",
  specific_humidity: "g/kg",
  surface_pressure: "hPa",
  soil_moisture_surface: "m³/m³",
  diurnal_temperature_range: "°C",
  temperature_max: "°C",
  temperature_min: "°C",
};

function paramUnit(param: string): string {
  return PARAM_UNITS[param] ?? "units";
}

export type ReportInput = {
  region: Region;
  point: [number, number] | null;
  stats: TrendStats;
  fingerprint: RegionFingerprint;
  anomalies: AnomalyReport;
  evidence: EvidenceRecord;
  period: [number, number];
  researchQuestion: string;
  dataStatus: string;
  trends?: Record<string, {
    slope_per_decade: number;
    p_value: number;
    significant: boolean;
    direction: string;
    n: number;
  }> | null;
  coverage?: {
    parameters_used: string[];
    parameters_unavailable?: string[];
    sources: Record<string, string>;
    synthetic_demo: boolean;
    time_range: [string, string];
  } | null;
  forecast?: {
    model: string;
    horizon_months: number;
    dates: string[];
    timeseries: Record<string, { mean: number[]; lower: number[]; upper: number[] }>;
    backtest?: {
      mae?: number;
      rmse?: number;
      picp_p10_p90?: number;
      per_parameter?: Record<string, { mae: number; rmse: number; picp_p10_p90: number; bias?: number }>;
    } | null;
  } | null;
  shareUrl: string;
};

/** Detailed, reproducible case-file report as a Markdown document. */
export function buildReportMarkdown(input: ReportInput): string {
  const {
    region,
    point,
    stats,
    fingerprint,
    anomalies,
    evidence,
    period,
    researchQuestion,
    dataStatus,
    trends,
    coverage,
    forecast,
    shareUrl,
  } = input;
  const variable = getVariable(region.variable);
  const significantLabel = stats.significant ? "statistically significant" : "not statistically significant";

  const trendLines = trends
    ? Object.entries(trends)
        .map(
          ([param, rec]) =>
            `- **${param}**: ${formatSignedNumber(rec.slope_per_decade)} ${paramUnit(param)}/decade · p = ${formatP(rec.p_value)} · ${rec.significant ? "significant" : "not significant"} · n = ${rec.n}`,
        )
        .join("\n")
    : "- (no per-parameter trend table supplied)";

  const fpLines = fingerprint.dimensions
    .map(
      (d) =>
        `- **${d.shortLabel}** (${d.dataset}): ${formatSignedNumber(d.slope)} ${d.slopeUnit} · p = ${formatP(d.pValue)} · ${d.significant ? "significant" : "not significant"}`,
    )
    .join("\n");

  const anomalyLines = anomalies.events.length
    ? anomalies.events
        .map(
          (ev) =>
            `- **${ev.monthLabel}**: ${formatSignedNumber(ev.departure)} ${ev.unit} vs seasonal baseline (z = ${formatSignedNumber(ev.zScore)})`,
        )
        .join("\n")
    : "- No statistically unusual months flagged (|robust z| ≥ 3.5).";

  const coverageLines = coverage
    ? [
        `- Record: ${coverage.time_range[0]} → ${coverage.time_range[1]} (${coverage.synthetic_demo ? "synthetic demo" : "real NASA POWER"})`,
        `- Parameters usable: ${coverage.parameters_used.join(", ") || "none"}`,
        coverage.parameters_unavailable?.length
          ? `- **Unavailable (never faked):** ${coverage.parameters_unavailable.join(", ")}`
          : "- No missing parameters",
        ...Object.entries(coverage.sources).map(([param, source]) => `  - ${param}: ${source}`),
      ].join("\n")
    : "- (no live coverage block available)";

  const forecastLines = forecast
    ? [
        `- Model: ${forecast.model} · horizon: ${forecast.horizon_months} months · window: ${forecast.dates[0]} → ${forecast.dates[forecast.dates.length - 1]}`,
        "- Forecasts are probabilistic p10–p90 bands, not certain futures.",
        ...Object.entries(forecast.timeseries).map(([param, block]) => {
          const mean = block.mean;
          const delta = mean.length > 1 ? mean[mean.length - 1] - mean[0] : 0;
          return `  - **${param}**: net change over the horizon = ${delta >= 0 ? "+" : ""}${delta.toFixed(3)} ${paramUnit(param)} (NOT per decade)`;
        }),
        forecast.backtest?.picp_p10_p90 !== undefined
          ? `- Backtest (rolling origin): MAE ${forecast.backtest.mae} · RMSE ${forecast.backtest.rmse} · PICP (p10–p90 coverage) ${forecast.backtest.picp_p10_p90}`
          : "- Backtest unavailable for this configuration.",
      ].join("\n")
    : "- (forecast not available — backend unreachable)";

  return `# Earth Pulse — Detailed Case Report: ${region.name}

**${variable.name}** · ${period[0]}–${period[1]} · ${region.bboxLabel}${point ? ` · pinned cell ${point[0].toFixed(2)}°, ${point[1].toFixed(2)}°` : " · no point pinned"}
**Research question:** ${researchQuestion}
**Data status:** ${dataStatus}
**Reproducible link:** ${shareUrl}

---

## 1. Headline finding

${variable.shortName} across ${region.name} is changing at **${formatSlope(stats)}** (${formatP(stats.pValue)}), ${significantLabel}.
${fingerprint.coupledInsight}

## 2. Per-parameter trends at this cell

${trendLines}

## 3. Trend fingerprint (multi-variable coupling)

${fpLines}

_${fingerprint.investigationLead}_

## 4. Forecast (probabilistic — not a certain future)

${forecastLines}

## 5. Anomalies (|robust z| ≥ 3.5)

${anomalyLines}

${anomalies.cautionNote}

## 6. Data coverage & provenance

${coverageLines}

## 7. Evidence & confidence

- **Dataset:** ${evidence.dataset} (${evidence.source})
- **Observation period:** ${evidence.observationPeriod}
- **Spatial resolution:** ${evidence.spatialResolution}
- **Statistical significance:** ${evidence.statisticalSignificance}
- **Missing data:** ${evidence.missingData}
- **Confidence level:** ${evidence.confidenceLevel}
- **Limitations:** ${evidence.limitations}

## 8. Honesty notes

- Trends are associations in the record, not causal attribution to human activity.
- The LLM never computed any number in this report; every figure above was computed by the backend.
- This report reproduces deterministically: same store, same engine, same stats.
`;
}
