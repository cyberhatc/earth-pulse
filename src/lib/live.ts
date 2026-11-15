import type {
  BackendAnomaly,
  BackendCoverage,
  BackendForecast,
  BackendOpposite,
  BackendPlace,
} from "./api";
import type {
  AnomalyReport,
  EvidenceRecord,
  FingerprintDimension,
  Region,
  RegionFingerprint,
  TrendStats,
  VariableKey,
} from "./types";
import { buildEvidenceRecord, computeFingerprint, detectAnomalies } from "./intelligence";
import {
  computeStats,
  computeStatsForSeries,
  formatP,
  formatSignedNumber,
  formatSlope,
  generateSeries,
} from "./trend";
import { getVariable } from "./data";

export type LiveStatus = "loading" | "live" | "partial" | "demo" | "error";

export type LiveAnalysis = {
  region: Region;
  target: [number, number];
  payload: BackendPlace | null;
  status: LiveStatus;
  isLive: boolean;
  param: string | null;
  sourceLabel: string;
  sourceNote: string;
  series: number[];
  dates: string[];
  stats: TrendStats;
  period: [number, number];
  coverage: BackendCoverage | null;
  forecast: BackendForecast | null;
  opposite: BackendOpposite[];
  backendAnomalies: BackendAnomaly[];
  anomalyReport: AnomalyReport;
  fingerprint: RegionFingerprint;
  evidence: EvidenceRecord;
  explanation: BackendPlace["explanation"] | null;
};

type ParamMeta = {
  label: string;
  shortLabel: string;
  unit: string;
  domain: FingerprintDimension["domain"];
  dataset: string;
};

export const PARAM_META: Record<string, ParamMeta> = {
  temperature: {
    label: "Air temperature (2 m)",
    shortLabel: "Temperature",
    unit: "°C",
    domain: "temperature",
    dataset: "NASA POWER T2M",
  },
  precipitation: {
    label: "Precipitation",
    shortLabel: "Rainfall",
    unit: "mm/month",
    domain: "rainfall",
    dataset: "NASA POWER PRECTOTCORR",
  },
  ndvi: {
    label: "Vegetation index (NDVI)",
    shortLabel: "NDVI",
    unit: "index",
    domain: "vegetation",
    dataset: "MODIS MOD13Q1 / AppEEARS",
  },
  sst: {
    label: "Sea-surface temperature",
    shortLabel: "SST",
    unit: "°C",
    domain: "water",
    dataset: "MODIS Aqua SST",
  },
  sea_level: {
    label: "Sea level",
    shortLabel: "Sea level",
    unit: "mm",
    domain: "water",
    dataset: "PO.DAAC sea level",
  },
  humidity: {
    label: "Relative humidity",
    shortLabel: "Humidity",
    unit: "%",
    domain: "water",
    dataset: "NASA POWER RH2M",
  },
  wind: {
    label: "Wind speed",
    shortLabel: "Wind",
    unit: "m/s",
    domain: "wind",
    dataset: "NASA POWER WS2M",
  },
  solar_radiation: {
    label: "Solar radiation",
    shortLabel: "Solar",
    unit: "MJ/m²/day",
    domain: "energy",
    dataset: "NASA POWER ALLSKY_SFC_SW_DWN",
  },
};

const PRIMARY_PARAM: Record<VariableKey, string> = {
  lst: "temperature",
  precipitation: "precipitation",
  ndvi: "ndvi",
  sea_ice: "sst",
  water_extent: "sea_level",
};

/** The frontend's case-file variable for a backend parameter (if they match). */
function liveParamFor(region: Region, payload: BackendPlace): string | null {
  const candidate = PRIMARY_PARAM[region.variable];
  const series = payload.past.timeseries[candidate];
  const trend = payload.trends[candidate];
  if (!series || !trend) return null;
  const finite = series.filter(
    (v) => typeof v === "number" && Number.isFinite(v),
  ).length;
  if (finite < 12) return null;
  return candidate;
}

function toNumberSeries(values: (number | null)[]): number[] | null {
  if (!values.length) return null;
  const out = values.map((v) =>
    typeof v === "number" && Number.isFinite(v) ? v : NaN,
  );
  const finiteIdx = out
    .map((v, i) => (Number.isFinite(v) ? i : -1))
    .filter((i) => i >= 0);
  if (finiteIdx.length < 12) return null;
  // Linear interpolation across interior gaps; nearest value at the edges.
  for (let i = 0; i < out.length; i += 1) {
    if (Number.isFinite(out[i])) continue;
    const prev = finiteIdx.filter((idx) => idx < i).pop();
    const next = finiteIdx.find((idx) => idx > i);
    if (prev !== undefined && next !== undefined) {
      const t = (i - prev) / (next - prev);
      out[i] = out[prev] + (out[next] - out[prev]) * t;
    } else if (prev !== undefined) {
      out[i] = out[prev];
    } else if (next !== undefined) {
      out[i] = out[next];
    }
  }
  return out.every((v) => Number.isFinite(v)) ? out : null;
}

function monthsBetween(period: [number, number]): string[] {
  const dates: string[] = [];
  for (let year = period[0]; year <= period[1]; year += 1) {
    for (let month = 1; month <= 12; month += 1) {
      dates.push(`${year}-${String(month).padStart(2, "0")}`);
    }
  }
  return dates;
}

function periodFromDates(dates: string[], fallback: [number, number]): [number, number] {
  if (!dates.length) return fallback;
  const start = Number(dates[0].slice(0, 4));
  const end = Number(dates[dates.length - 1].slice(0, 4));
  if (!Number.isFinite(start) || !Number.isFinite(end)) return fallback;
  return [start, end];
}

function directionFromBackend(direction: string): TrendStats["direction"] {
  const d = direction.toLowerCase();
  if (d.includes("increas") || d === "up") return "up";
  if (d.includes("decreas") || d === "down") return "down";
  return "flat";
}

function buildLiveFingerprint(
  region: Region,
  payload: BackendPlace,
): RegionFingerprint {
  const order = [
    "temperature",
    "precipitation",
    "ndvi",
    "sst",
    "sea_level",
    "humidity",
    "wind",
    "solar_radiation",
  ];
  const dimensions: FingerprintDimension[] = [];
  for (const param of order) {
    const trend = payload.trends[param];
    const meta = PARAM_META[param];
    if (!trend || trend.n < 12 || !meta) continue;
    if (dimensions.some((d) => d.domain === meta.domain)) continue;
    const direction = directionFromBackend(trend.direction);
    const zMag = trend.significant ? (trend.p_value < 0.01 ? 2.2 : 1.6) : 0.6;
    dimensions.push({
      key: param,
      domain: meta.domain,
      label: `${meta.label}${payload.data_coverage.synthetic_demo ? " (synthetic)" : ""}`,
      shortLabel: meta.shortLabel,
      slope: trend.slope_per_decade,
      slopeUnit: `${meta.unit}/decade`,
      pValue: trend.p_value,
      significant: trend.significant,
      direction,
      zScore: direction === "down" ? -zMag : zMag,
      dataset:
        payload.data_coverage.sources[param] ||
        (payload.data_coverage.synthetic_demo
          ? "Synthetic demo store"
          : meta.dataset),
    });
    if (dimensions.length === 4) break;
  }

  if (dimensions.length < 2) {
    return computeFingerprint(region);
  }

  const lines = dimensions.map(
    (d) =>
      `${d.shortLabel} ${formatSignedNumber(d.slope)} ${d.slopeUnit} (${formatP(d.pValue)}, ${
        d.significant ? "significant" : "not significant"
      })`,
  );
  const synthetic = payload.data_coverage.synthetic_demo;
  return {
    dimensions,
    coupledInsight: `${synthetic ? "Backend synthetic demo store" : "Live backend NASA POWER record"} · ${payload.data_coverage.time_range[0]}–${payload.data_coverage.time_range[1]}: ${lines.join("; ")}.`,
    investigationLead:
      "The backend computes these with Theil–Sen slopes and Mann–Kendall significance. Check per-parameter coverage before combining land and ocean variables.",
    significantCount: dimensions.filter((d) => d.significant).length,
  };
}

function buildLiveEvidence(
  region: Region,
  stats: TrendStats,
  param: string | null,
  payload: BackendPlace,
  point: [number, number] | null,
): EvidenceRecord {
  const base = buildEvidenceRecord(region, stats, "evidence", point);
  const coverage = payload.data_coverage;
  const meta = param ? PARAM_META[param] : null;
  const dates = payload.past.dates;
  const periodText = dates.length
    ? `${dates[0]}–${dates[dates.length - 1]}`
    : coverage.time_range.join("–");
  const gaps = (coverage.gap_notes || coverage.gaps || []).filter(Boolean);
  const unavailable = coverage.parameters_unavailable || [];
  return {
    ...base,
    dataset: meta ? `${meta.dataset} (${param})` : base.dataset,
    source:
      (param && coverage.sources[param]) ||
      (coverage.synthetic_demo
        ? "Bundled synthetic demo store"
        : "NASA POWER / NASA Earthdata"),
    observationPeriod: `${periodText} (${payload.past.dates.length} monthly records)`,
    spatialResolution: `Nearest 15° analysis cell (${payload.location.grid_lat}°, ${payload.location.grid_lon}°); POWER source ~0.5°`,
    trendMagnitude: `${formatSlope(stats)} (backend Theil–Sen slope; p=${stats.pValue.toFixed(4)})`,
    statisticalSignificance: `${formatP(stats.pValue)} (${stats.significant ? "Mann–Kendall significant at α = 0.05" : "above α = 0.05 threshold"}), n=${payload.trends[param || ""]?.n ?? payload.past.dates.length}`,
    missingData: unavailable.length
      ? `Unavailable at this cell: ${unavailable.join(", ")}.`
      : "All backend parameters usable at this cell.",
    confidenceLevel: stats.significant
      ? "High"
      : payload.past.dates.length > 240
        ? "Moderate"
        : "Low",
    limitations: `${coverage.synthetic_demo ? "Synthetic demo data — not observations. " : ""}${gaps.slice(0, 2).join(" ")} ${base.limitations}`.trim(),
  };
}

function makeDemoAnalysis(
  region: Region,
  target: [number, number],
  status: LiveStatus,
  note?: string,
): LiveAnalysis {
  const variable = getVariable(region.variable);
  const series = generateSeries(region);
  const dates = monthsBetween(region.period);
  const stats = computeStats(region, series);
  const anomalyReport = detectAnomalies(region, series, dates);
  const fingerprint = computeFingerprint(region);
  const evidence = buildEvidenceRecord(region, stats, "finding", target);
  return {
    region,
    target,
    payload: null,
    status,
    isLive: false,
    param: null,
    sourceLabel: "Local demonstration series",
    sourceNote:
      note ||
      "Backend data is loading or unavailable. This is the frontend's deterministic demonstration series, not a NASA observation.",
    series,
    dates,
    stats,
    period: region.period,
    coverage: null,
    forecast: null,
    opposite: [],
    backendAnomalies: [],
    anomalyReport,
    fingerprint,
    evidence: { ...evidence, source: "Frontend demo series (not the backend)" },
    explanation: null,
  };
}

export function demoAnalysis(
  region: Region,
  point: [number, number] | null = null,
  status: LiveStatus = "demo",
  note?: string,
): LiveAnalysis {
  return makeDemoAnalysis(region, point ?? region.center, status, note);
}

export function deriveLiveAnalysis(
  region: Region,
  payload: BackendPlace | null,
  point: [number, number] | null,
): LiveAnalysis {
  const target = point ?? region.center;
  if (!payload) return makeDemoAnalysis(region, target, "loading");

  const variable = getVariable(region.variable);
  const param = liveParamFor(region, payload);
  const unavailable = payload.data_coverage.parameters_unavailable || [];
  const primary = PRIMARY_PARAM[region.variable];
  const meta = param ? PARAM_META[param] : null;
  const rawSeries = param ? payload.past.timeseries[param] : null;
  const series = rawSeries ? toNumberSeries(rawSeries) : null;

  if (!param || !meta || !series) {
    const demo = makeDemoAnalysis(
      region,
      target,
      "partial",
      `The backend has no usable ${variable.shortName} (${primary}) record at this cell — available: ${
        payload.data_coverage.parameters_used.join(", ") || "none"
      }. Showing the local demonstration series; live trends, forecast and anomalies are still available in chat and the forecast/coverage cards.`,
    );
    demo.payload = payload;
    demo.period = periodFromDates(payload.past.dates, region.period);
    demo.coverage = payload.data_coverage;
    demo.forecast = payload.forecast;
    demo.opposite = payload.opposite_trends || [];
    demo.backendAnomalies = payload.past.anomalies || [];
    demo.fingerprint = buildLiveFingerprint(region, payload);
    demo.explanation = payload.explanation;
    return demo;
  }

  const trend = payload.trends[param];
  const ols = computeStatsForSeries(series, variable.perDecadeUnit);
  const stats: TrendStats = {
    ...ols,
    slope: trend?.slope_per_decade ?? ols.slope,
    pValue: trend?.p_value ?? ols.pValue,
    significant: trend?.significant ?? ols.significant,
    direction: trend ? directionFromBackend(trend.direction) : ols.direction,
  };
  const dates = payload.past.dates;
  const period = periodFromDates(dates, region.period);
  const anomalyReport = detectAnomalies(region, series, dates);
  const fingerprint = buildLiveFingerprint(region, payload);
  const evidence = buildLiveEvidence(region, stats, param, payload, point);
  const synthetic = payload.data_coverage.synthetic_demo;

  return {
    region,
    target,
    payload,
    status: "live",
    isLive: true,
    param,
    sourceLabel: `${synthetic ? "Backend synthetic demo" : "Live backend"} · ${meta.dataset}`,
    sourceNote: `${payload.forecast.model} forecast · ${payload.data_coverage.time_range[0]}–${payload.data_coverage.time_range[1]} · ${unavailable.length ? `missing ${unavailable.join(", ")}` : "all parameters available"}`,
    series,
    dates,
    stats,
    period,
    coverage: payload.data_coverage,
    forecast: payload.forecast,
    opposite: payload.opposite_trends || [],
    backendAnomalies: payload.past.anomalies || [],
    anomalyReport,
    fingerprint,
    evidence,
    explanation: payload.explanation,
  };
}

/** Pick a parameter for the forecast card, preferring the case-file variable. */
export function forecastParamFor(
  region: Region,
  analysis: LiveAnalysis,
): string | null {
  if (!analysis.forecast) return null;
  const preferred = analysis.param || PRIMARY_PARAM[region.variable];
  if (analysis.forecast.timeseries[preferred]) return preferred;
  for (const candidate of ["temperature", "precipitation", "humidity", "wind"]) {
    if (analysis.forecast.timeseries[candidate]) return candidate;
  }
  return Object.keys(analysis.forecast.timeseries)[0] ?? null;
}

export function coverageGaps(coverage: BackendCoverage | null): string[] {
  if (!coverage) return [];
  const gaps = coverage.gap_notes || coverage.gaps || [];
  return gaps.filter((gap) => Boolean(gap && gap.trim()));
}
