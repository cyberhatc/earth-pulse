import test from "node:test";
import assert from "node:assert/strict";
import { REGIONS, getRegion, getVariable, hashSlug, seeded } from "./data";
import {
  colorForSlope,
  computeStats,
  formatCoords,
  formatP,
  formatSlope,
  generateSeries,
} from "./trend";
import { generateReply } from "./chat";
import { nextTheme, resolveInitialTheme } from "./theme";
import {
  buildEvidenceRecord,
  buildInvestigationMarkdown,
  computeFingerprint,
  detectAnomalies,
  generateLocalStory,
} from "./intelligence";

test("seeded RNG and hashSlug are deterministic", () => {
  const r1 = seeded(hashSlug("western-ghats"));
  const r2 = seeded(hashSlug("western-ghats"));
  assert.equal(r1(), r2());
  assert.equal(r1(), r2());
  assert.notEqual(hashSlug("western-ghats"), hashSlug("california-coast"));
});

test("region catalog includes the 3 coupled land-ocean regions with exact bounding boxes", () => {
  assert.equal(REGIONS.length, 3);

  const ghats = getRegion("western-ghats");
  assert.ok(ghats);
  assert.deepEqual(ghats.bounds, [
    [8.0, 70.0],
    [20.0, 78.0],
  ]);
  assert.equal(getVariable(ghats.variable).shortName, "Rainfall");

  const ncp = getRegion("north-china-plain");
  assert.ok(ncp);
  assert.deepEqual(ncp.bounds, [
    [30.0, 110.0],
    [42.0, 125.0],
  ]);
  assert.equal(getVariable(ncp.variable).shortName, "Temp");

  const cali = getRegion("california-coast");
  assert.ok(cali);
  assert.deepEqual(cali.bounds, [
    [32.0, -122.0],
    [42.0, -117.0],
  ]);
  assert.equal(getVariable(cali.variable).shortName, "NDVI");

  assert.equal(getRegion("nonexistent"), undefined);
});

test("generateSeries produces expected month counts and deterministic values", () => {
  const ghats = getRegion("western-ghats")!;
  const seriesA = generateSeries(ghats);
  const seriesB = generateSeries(ghats);
  assert.equal(seriesA.length, (2024 - 2000 + 1) * 12);
  assert.deepEqual(seriesA, seriesB);
});

test("computeStats identifies upward trends in Western Ghats/North China Plain and downward NDVI in California Coast", () => {
  const ghats = getRegion("western-ghats")!;
  const ghatsStats = computeStats(ghats, generateSeries(ghats));
  assert.equal(ghatsStats.direction, "up");
  assert.equal(ghatsStats.significant, true);
  assert.ok(ghatsStats.slope > 0);
  assert.match(formatSlope(ghatsStats), /^\+\d+\.\d{2,3} mm\/month\/decade$/);

  const ncp = getRegion("north-china-plain")!;
  const ncpStats = computeStats(ncp, generateSeries(ncp));
  assert.equal(ncpStats.direction, "up");
  assert.equal(ncpStats.significant, true);
  assert.match(formatSlope(ncpStats), /^\+\d+\.\d{2,3} °C\/decade$/);

  const cali = getRegion("california-coast")!;
  const caliStats = computeStats(cali, generateSeries(cali));
  assert.equal(caliStats.direction, "down");
  assert.equal(caliStats.significant, true);
  assert.ok(caliStats.slope < 0);
  assert.match(formatSlope(caliStats), /^-\d+\.\d{2,3} index\/decade$/);
});

test("formatP, colorForSlope, and formatCoords produce expected outputs", () => {
  assert.equal(formatP(0.0002), "p < 0.001");
  assert.equal(formatP(0.0421), "p = 0.042");

  assert.equal(colorForSlope(0.02), "rgba(154,163,160,0.55)");
  assert.match(colorForSlope(0.5), /^rgba\(180,67,24,/);
  assert.match(colorForSlope(-0.5), /^rgba\(30,64,175,/);

  assert.equal(formatCoords(14.52, 74.14, 2), "14.52°N, 74.14°E");
  assert.equal(formatCoords(36.5, -120.6, 1), "36.5°N, 120.6°W");
});

test("generateReply routes keywords in priority order", () => {
  const ghats = getRegion("western-ghats")!;
  const stats = computeStats(ghats, generateSeries(ghats));

  assert.equal(generateReply("Where is it changing?", ghats, stats).cardKind, "slope-map");
  assert.equal(generateReply("What is Rainfall?", ghats, stats).cardKind, "variable");
  assert.equal(generateReply("What does significant mean?", ghats, stats).cardKind, "caveat");
  assert.equal(generateReply("Is this statistically significant?", ghats, stats).cardKind, "caveat");
  assert.equal(generateReply("Show me the trend over time", ghats, stats).cardKind, "trend-chart");
  assert.equal(generateReply("Is rainfall increasing?", ghats, stats).cardKind, "finding");
  assert.equal(generateReply("Hello", ghats, stats).cardKind, "finding");
});

test("theme helpers resolve stored preference and toggle deterministically", () => {
  assert.equal(resolveInitialTheme("dark", false), "dark");
  assert.equal(resolveInitialTheme("light", true), "light");
  assert.equal(resolveInitialTheme(null, true), "dark");
  assert.equal(resolveInitialTheme("invalid", false), "light");
  assert.equal(nextTheme("light"), "dark");
  assert.equal(nextTheme("dark"), "light");
});

test("computeFingerprint returns 4 honestly-labelled demonstration dimensions", () => {
  const ncp = getRegion("north-china-plain")!;
  const fp = computeFingerprint(ncp);
  assert.equal(fp.dimensions.length, 4);
  assert.ok(fp.coupledInsight.toLowerCase().includes("demonstration"));
  assert.ok(fp.dimensions.every((d) => d.dataset.includes("demonstration")));
  assert.ok(fp.investigationLead.length > 15);
});

test("buildEvidenceRecord includes all provenance fields and bbox note", () => {
  const ghats = getRegion("western-ghats")!;
  const stats = computeStats(ghats, generateSeries(ghats));
  const ev = buildEvidenceRecord(ghats, stats, "finding");
  assert.ok(ev.dataset.toLowerCase().includes("demonstration"));
  assert.ok(ev.source.length > 0);
  assert.ok(ev.observationPeriod.includes("2000–2024"));
  assert.ok(ev.spatialResolution.length > 0);
  assert.ok(ev.trendMagnitude.includes("mm/month/decade"));
  assert.ok(ev.statisticalSignificance.includes("significant at α = 0.05"));
  assert.ok(ev.missingData.length > 0);
  assert.ok(ev.limitations.includes("8°N–20°N, 70°E–78°E"));
});

test("detectAnomalies finds seasonal departures and includes caution note", () => {
  const cali = getRegion("california-coast")!;
  const series = generateSeries(cali);
  const report = detectAnomalies(cali, series);
  assert.equal(report.events.length, 3);
  assert.equal(report.baselineByMonth.length, 12);
  assert.ok(report.cautionNote.includes("not automatically a disaster"));
  assert.equal(report.hotspot, null);
});

test("generateLocalStory supports English, Hindi, and Kannada across audiences", () => {
  const ghats = getRegion("western-ghats")!;
  const stats = computeStats(ghats, generateSeries(ghats));
  const fp = computeFingerprint(ghats);
  const en = generateLocalStory(ghats, stats, fp, "en", "student");
  const hi = generateLocalStory(ghats, stats, fp, "hi", "journalist");
  const kn = generateLocalStory(ghats, stats, fp, "kn", "researcher");
  assert.ok(en.body.includes("Arabian Sea"));
  assert.ok(/[\u0900-\u097F]/.test(hi.body));
  assert.ok(/[\u0C80-\u0CFF]/.test(kn.body));
});

test("buildInvestigationMarkdown generates complete reproducible report with bbox", () => {
  const ncp = getRegion("north-china-plain")!;
  const series = generateSeries(ncp);
  const stats = computeStats(ncp, series);
  const fp = computeFingerprint(ncp);
  const anomalies = detectAnomalies(ncp, series);
  const ev = buildEvidenceRecord(ncp, stats, "finding");
  const md = buildInvestigationMarkdown({
    region: ncp,
    point: [36.0, 117.5],
    researchQuestion: "What changed unusually?",
    stats,
    fingerprint: fp,
    anomalies,
    evidence: ev,
    shareUrl: "http://localhost:3000/region/north-china-plain/notebook",
  });
  assert.ok(md.includes("## 1. Research Question"));
  assert.ok(md.includes("30°N–42°N, 110°E–125°E"));
  assert.ok(md.includes("36.00°N, 117.50°E"));
});

test("generateReply routes new prompts to fingerprint, anomaly, earth-twins, story, and evidence cards", () => {
  const cali = getRegion("california-coast")!;
  const stats = computeStats(cali, generateSeries(cali));
  assert.equal(generateReply("Show the trend fingerprint", cali, stats).cardKind, "fingerprint");
  assert.equal(generateReply("What changed unusually in this region?", cali, stats).cardKind, "anomaly");
  assert.equal(generateReply("Find Earth twins across continents", cali, stats).cardKind, "earth-twins");
  assert.equal(generateReply("Tell the local story in Kannada", cali, stats).cardKind, "story");
  assert.equal(generateReply("Show me the dataset evidence", cali, stats).cardKind, "evidence");
});
