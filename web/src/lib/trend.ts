import { getVariable, hashSlug, seeded } from "./data";
import type { Region, TrendStats } from "./types";

// DEMONSTRATION series — synthetic, deterministic, used ONLY when the backend
// is unreachable. The UI labels this mode "Local demonstration series"; it is
// never presented as a NASA observation. Live mode replaces it with the
// backend's NASA POWER store.
export function generateSeries(region: Region): number[] {
  const months = (region.period[1] - region.period[0] + 1) * 12;
  const perMonthTrend =
    region.trendShape === "up"
      ? region.variable === "lst"
        ? 0.0028
        : region.variable === "precipitation"
          ? 0.0042
          : 0.000025
      : region.variable === "ndvi"
        ? -0.000028
        : region.variable === "sea_ice"
          ? -0.0008
          : region.variable === "water_extent"
            ? -0.0035
            : -0.002;

  const seasonalAmp =
    region.variable === "lst"
      ? 6
      : region.variable === "sea_ice"
        ? 4
        : region.variable === "precipitation"
          ? 24
          : region.variable === "water_extent"
            ? 1.5
            : 0.08;

  const rand = seeded(hashSlug(region.slug));
  const series: number[] = [];

  for (let i = 0; i < months; i += 1) {
    const linear = region.baseline + perMonthTrend * i * 10;
    const seasonal = seasonalAmp * Math.sin((i / 12) * 2 * Math.PI - Math.PI / 2);
    const noise = (rand() - 0.5) * seasonalAmp * 0.65;
    const interannual =
      seasonalAmp * 0.12 * Math.sin((i / 84) * 2 * Math.PI);
    series.push(linear + seasonal + noise + interannual);
  }

  return series;
}

// DEMO approximation — replace with real Mann-Kendall + Sen's slope + autocorrelation correction.
export function computeStats(region: Region, series: number[]): TrendStats {
  return computeStatsForSeries(series, getVariable(region.variable).perDecadeUnit);
}

export function computeStatsForSeries(
  series: number[],
  slopeUnit: string,
): TrendStats {
  const n = series.length;

  if (n < 2) {
    return {
      slope: 0,
      slopeUnit,
      pValue: 1,
      significant: false,
      ciLow: 0,
      ciHigh: 0,
      direction: "flat",
    };
  }

  const xMean = (n - 1) / 2;
  let ySum = 0;
  for (let i = 0; i < n; i += 1) {
    ySum += series[i];
  }
  const yMean = ySum / n;

  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = i - xMean;
    const dy = series[i] - yMean;
    sxx += dx * dx;
    sxy += dx * dy;
  }

  const slopePerSample = sxx === 0 ? 0 : sxy / sxx;
  const intercept = yMean - slopePerSample * xMean;
  const slope = slopePerSample * 12 * 10;

  let ssRes = 0;
  for (let i = 0; i < n; i += 1) {
    const fitted = intercept + slopePerSample * i;
    const err = series[i] - fitted;
    ssRes += err * err;
  }

  const residualStd = n > 2 ? Math.sqrt(ssRes / (n - 2)) : 0;
  const seSlope = sxx > 0 ? residualStd / Math.sqrt(sxx) : 0;
  const tStat = slopePerSample / Math.max(seSlope, 1e-9);
  const pValue = Math.exp(-Math.abs(tStat) * 1.6);
  const ciHalf = 1.96 * seSlope * 120;

  const direction: TrendStats["direction"] =
    Math.abs(slope) < 0.005 ? "flat" : slope > 0 ? "up" : "down";

  return {
    slope,
    slopeUnit,
    pValue,
    significant: pValue < 0.05,
    ciLow: slope - ciHalf,
    ciHigh: slope + ciHalf,
    direction,
  };
}

export function formatSignedNumber(value: number): string {
  const sign = value >= 0 ? "+" : "-";
  const abs = Math.abs(value);
  const formatted = abs < 1 ? abs.toFixed(3) : abs.toFixed(2);
  return `${sign}${formatted}`;
}

export function formatSlope(stats: Pick<TrendStats, "slope" | "slopeUnit">): string {
  return `${formatSignedNumber(stats.slope)} ${stats.slopeUnit}`;
}

export function formatP(p: number): string {
  return p < 0.001 ? "p < 0.001" : `p = ${p.toFixed(3)}`;
}

export function colorForSlope(slope: number): string {
  const a = Math.min(1, Math.abs(slope) / 1.5);
  if (Math.abs(slope) < 0.08) {
    return "rgba(154,163,160,0.55)";
  }
  if (slope > 0) {
    return `rgba(180,67,24,${(0.28 + a * 0.58).toFixed(3)})`;
  }
  return `rgba(30,64,175,${(0.28 + a * 0.58).toFixed(3)})`;
}

export function formatCoords(lat: number, lng: number, decimals = 2): string {
  const latHem = lat >= 0 ? "N" : "S";
  const lngHem = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(decimals)}°${latHem}, ${Math.abs(lng).toFixed(decimals)}°${lngHem}`;
}
