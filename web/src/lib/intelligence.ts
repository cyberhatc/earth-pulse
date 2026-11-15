import { getVariable } from "./data";
import {
  computeStats,
  formatCoords,
  formatP,
  formatSignedNumber,
  formatSlope,
  generateSeries,
} from "./trend";
import type {
  AnomalyEvent,
  AnomalyReport,
  CardKind,
  EvidenceRecord,
  FingerprintDimension,
  Region,
  RegionFingerprint,
  StoryAudience,
  StoryLanguage,
  TrendStats,
  VariableKey,
} from "./types";

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// A. Earth Trend Fingerprint — 4 coupled land-ocean variables per region
// Local demonstration fingerprint — used only when the backend is unreachable
// or has fewer than two usable dimensions. Every number below is derived from
// the frontend's synthetic demonstration series (see trend.ts generateSeries);
// it is NOT a NASA observation and the UI labels it as such.
export function computeFingerprint(region: Region): RegionFingerprint {
  const demoFor = (key: VariableKey) =>
    generateSeries({ ...region, variable: key, trendShape: region.trendShape });
  const statsFor = (key: VariableKey) =>
    computeStats({ ...region, variable: key }, demoFor(key));

  const makeDim = (
    key: VariableKey,
    domain: FingerprintDimension["domain"],
    label: string,
    shortLabel: string,
    unitOverride?: string,
  ): FingerprintDimension => {
    const variable = getVariable(key);
    const st = statsFor(key);
    const zScore =
      st.direction === "up" ? 1.5 : st.direction === "down" ? -1.5 : 0;
    return {
      key,
      domain,
      label,
      shortLabel,
      slope: st.slope,
      slopeUnit: unitOverride ?? variable.perDecadeUnit,
      pValue: st.pValue,
      significant: st.significant,
      direction: st.direction,
      zScore,
      dataset: "Local demonstration estimate (not NASA data)",
    };
  };

  const primaryStats = computeStats(region, generateSeries(region));
  const dimensions: FingerprintDimension[] = [
    makeDim("lst", "temperature", "Local Surface Temperature (demo)", "Temp"),
    makeDim("ndvi", "vegetation", "Local Vegetation Index (demo)", "NDVI"),
    makeDim("precipitation", "rainfall", "Local Rainfall (demo)", "Rain"),
    makeDim("water_extent", "water", "Local Coastal Water (demo)", "Water", "%/decade-equivalent"),
  ];
  const significant = dimensions.filter((d) => d.significant).length;

  return {
    dimensions,
    coupledInsight: `Local demonstration fingerprint — the backend is offline, so these four dimensions are computed from a deterministic synthetic series, not NASA observations (${formatSlope(primaryStats)}, ${formatP(primaryStats.pValue)} for the primary variable). Connect the backend for the live NASA POWER fingerprint.`,
    investigationLead:
      "Connect the backend for measured NASA POWER values before drawing any conclusion; the demonstration fingerprint only exercises the UI.",
    significantCount: significant,
  };
}

// B. Trust Me: Evidence & Confidence Layer
export function buildEvidenceRecord(
  region: Region,
  stats: TrendStats,
  cardKind: CardKind,
  point?: [number, number] | null,
): EvidenceRecord {
  const months = (region.period[1] - region.period[0] + 1) * 12;

  // Shown only in demo mode (backend offline). These are honest labels for the
  // frontend's synthetic demonstration series — NOT satellite observations.
  // In live mode buildLiveEvidence() overrides every field with NASA POWER facts.
  const datasetMap: Record<
    VariableKey,
    { dataset: string; source: string; res: string; missing: string }
  > = {
    lst: {
      dataset: "Local demonstration series — temperature",
      source: "Frontend deterministic demo (no NASA observations)",
      res: "synthetic series — not a measured grid",
      missing: "n/a — synthetic demo series has no real coverage gaps",
    },
    sea_ice: {
      dataset: "Local demonstration series — sea ice",
      source: "Frontend deterministic demo (no NASA observations)",
      res: "synthetic series — not a measured grid",
      missing: "n/a — synthetic demo series has no real coverage gaps",
    },
    water_extent: {
      dataset: "Local demonstration series — water",
      source: "Frontend deterministic demo (no NASA observations)",
      res: "synthetic series — not a measured grid",
      missing: "n/a — synthetic demo series has no real coverage gaps",
    },
    ndvi: {
      dataset: "Local demonstration series — vegetation",
      source: "Frontend deterministic demo (no NASA observations)",
      res: "synthetic series — not a measured grid",
      missing: "n/a — synthetic demo series has no real coverage gaps",
    },
    precipitation: {
      dataset: "Local demonstration series — precipitation",
      source: "Frontend deterministic demo (no NASA observations)",
      res: "synthetic series — not a measured grid",
      missing: "n/a — synthetic demo series has no real coverage gaps",
    },
  };

  const meta = datasetMap[region.variable];
  const magnitude = `${formatSlope(stats)} (95% CI: ${formatSignedNumber(stats.ciLow)} to ${formatSignedNumber(stats.ciHigh)})`;

  const scopeNote =
    cardKind === "anomaly"
      ? "Seasonal departures use detrended 12-month climatology; a short-term monsoon or heat spike does not establish a long-term trend shift."
      : cardKind === "earth-twins"
        ? "Climate twins come from backend k-means clustering of cell temperature and precipitation means; NDVI/SST are excluded because NASA POWER does not provide them."
        : `Bounding box ${region.bboxLabel} spans both terrestrial and marine pixels; lag-1 autocorrelation pre-whitening is omitted in this demo test.`;

  return {
    dataset: meta.dataset,
    source: meta.source,
    observationPeriod: `${region.period[0]}–${region.period[1]} (${months} monthly records)`,
    spatialResolution: meta.res,
    trendMagnitude: magnitude,
    statisticalSignificance: `${formatP(stats.pValue)} (${stats.significant ? "significant at α = 0.05" : "above α = 0.05 threshold"})`,
    missingData: meta.missing,
    confidenceLevel: stats.significant ? "High" : "Moderate",
    limitations: scopeNote,
  };
}

// C. Earth Anomaly Detective — seasonal baseline departures
// `hotspot` must be a measured analysis cell (passed by the live backend path);
// when omitted, no location is fabricated in the summary.
export function detectAnomalies(
  region: Region,
  series: number[],
  dates?: string[],
  hotspot?: [number, number] | null,
): AnomalyReport {
  const variable = getVariable(region.variable);
  const n = series.length;
  const baselineByMonth = new Array<number>(12).fill(0);
  const counts = new Array<number>(12).fill(0);

  const xMean = (n - 1) / 2;
  const yMean = series.reduce((a, b) => a + b, 0) / Math.max(1, n);
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i += 1) {
    sxx += (i - xMean) ** 2;
    sxy += (i - xMean) * (series[i] - yMean);
  }
  const slope = sxx === 0 ? 0 : sxy / sxx;

  const detrended: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const val = series[i] - slope * (i - xMean);
    detrended.push(val);
    const m = i % 12;
    baselineByMonth[m] += val;
    counts[m] += 1;
  }

  for (let m = 0; m < 12; m += 1) {
    baselineByMonth[m] = counts[m] > 0 ? baselineByMonth[m] / counts[m] : 0;
  }

  const residuals = detrended.map((v, i) => v - baselineByMonth[i % 12]);
  const resMean = residuals.reduce((a, b) => a + b, 0) / Math.max(1, n);
  const resStd =
    Math.sqrt(
      residuals.reduce((acc, r) => acc + (r - resMean) ** 2, 0) /
        Math.max(1, n - 1),
    ) || 1;

  const events: AnomalyEvent[] = residuals
    .map((r, i) => {
      const zScore = (r - resMean) / resStd;
      const dateLabel = dates?.[i];
      const year = dateLabel
        ? Number(dateLabel.slice(0, 4))
        : region.period[0] + Math.floor(i / 12);
      const month = dateLabel
        ? Math.max(0, Number(dateLabel.slice(5, 7)) - 1)
        : i % 12;
      return {
        index: i,
        year,
        month,
        monthLabel: `${MONTH_NAMES[month]} ${year}`,
        value: series[i],
        baselineValue: baselineByMonth[month] + slope * (i - xMean),
        departure: r,
        zScore,
        unit: variable.unit,
      };
    })
    .sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore))
    .slice(0, 3);

  // Never fabricate a coordinate. Live callers pass the real analysis cell
  // (nearest 15° POWER grid cell); demo callers pass nothing.
  const hotspotCell: [number, number] | null = hotspot ?? null;

  const top = events[0];
  return {
    events,
    hotspot: hotspotCell,
    baselineByMonth,
    summary: top
      ? `Sharpest seasonal departure occurred in ${top.monthLabel} (${formatSignedNumber(top.departure)} ${variable.unit}, z = ${formatSignedNumber(top.zScore)})${
          hotspotCell
            ? ` — nearest analysis cell ${formatCoords(hotspotCell[0], hotspotCell[1], 1)}.`
            : "."
        }`
      : "No extreme seasonal departures detected.",
    cautionNote:
      "An anomaly is a temporary departure relative to the historical seasonal cycle — it is not automatically a disaster or a permanent climate trend.",
  };
}

// F. Local Earth Stories (English, Hindi, Kannada × Student, Journalist, Researcher)
export function generateLocalStory(
  region: Region,
  stats: TrendStats,
  fingerprint: RegionFingerprint,
  language: StoryLanguage,
  audience: StoryAudience,
  useWesternGhatsCase = false,
  period?: [number, number],
): { title: string; body: string; takeaway: string; placeLabel: string } {
  const variable = getVariable(region.variable);
  const placeName = useWesternGhatsCase
    ? "Western Ghats + Arabian Sea"
    : region.name;
  const slopeText = formatSlope(stats);
  const periodText = `${(period ?? region.period)[0]}–${(period ?? region.period)[1]}`;
  const pText = formatP(stats.pValue);
  const bboxText = useWesternGhatsCase
    ? "8°N–20°N, 70°E–78°E"
    : region.bboxLabel;

  if (language === "hi") {
    if (audience === "student") {
      return {
        placeLabel: placeName,
        title: `${placeName}: उपग्रह डेटा की सरल कहानी`,
        body: `${periodText} के बीच NASA POWER के रिकॉर्ड ने ${placeName} (${bboxText}) में भूमि और पास के समुद्र दोनों को मापा। यहाँ प्रमुख बदलाव की दर ${slopeText} (${pText}) है। जब समुद्र और ज़मीन एक साथ बदलते हैं, तो वैज्ञानिक तापमान, वनस्पति, वर्षा और महासागर चारों संकेतों को मिलाकर पूरा चित्र समझते हैं।`,
        takeaway: "मुख्य सीख: हर निष्कर्ष को डेटा, क्षेत्र-सीमा और साक्ष्य कार्ड से जोड़ा गया है।",
      };
    }
    if (audience === "journalist") {
      return {
        placeLabel: placeName,
        title: `${placeName} रिपोर्टिंग ब्रीफ: भूमि-समुद्र प्रमाणित रुझान`,
        body: `NASA POWER रिकॉर्ड (${periodText}, ${bboxText}) के अनुसार, ${placeName} में प्रमुख परिवर्तन दर ${slopeText} (${pText}) दर्ज की गई है। ${fingerprint.significantCount}/4 संकेतक सांख्यिकीय रूप से महत्वपूर्ण हैं। पत्रकार किसी भी एक मौसमी घटना को दीर्घकालिक जलवायु प्रवृत्ति मानने से पहले साक्ष्य कार्ड में लापता डेटा और स्थानीय मानचित्र की जाँच कर सकते हैं।`,
        takeaway: "पत्रकार नोट: हर आँकड़ा स्रोत, रिज़ॉल्यूशन और 95% विश्वास अंतराल के साथ सत्यापित है।",
      };
    }
    return {
      placeLabel: placeName,
      title: `${placeName}: सांख्यिकीय एवं बहु-चर फिंगरप्रिंट`,
      body: `${placeName} (${bboxText}, ${periodText}) में ${variable.name} की रैखिक प्रवृत्ति ${slopeText} (${pText}, 95% CI: ${formatSignedNumber(stats.ciLow)} से ${formatSignedNumber(stats.ciHigh)}) है। 4-आयामी भूमि-समुद्र फिंगरप्रिंट में ${fingerprint.significantCount}/4 संकेतक α = 0.05 पर सार्थक हैं। ${fingerprint.investigationLead}`,
      takeaway: "शोधकर्ता नोट: पुनरुत्पादनीय केस फ़ाइल नोटबुक से डाउनलोड की जा सकती है।",
    };
  }

  if (language === "kn") {
    if (audience === "student") {
      return {
        placeLabel: placeName,
        title: `${placeName}: ಉಪಗ್ರಹ ದತ್ತಾಂಶದ ಸರಳ ಕಥೆ`,
        body: `${periodText} ಅವಧಿಯಲ್ಲಿ NASA NASA POWER ದಾಖಲೆಗಳು ${placeName} (${bboxText}) ಪ್ರದೇಶದ ನೆಲ ಮತ್ತು ಸಮುದ್ರದ ಬದಲಾವಣೆಗಳನ್ನು ಅಳೆದಿವೆ. ಇಲ್ಲಿನ ಪ್ರಮುಖ ಬದಲಾವಣೆಯ ದರ ${slopeText} (${pText}) ಆಗಿದೆ. ತಾಪಮಾನ, ಸಸ್ಯವರ್ಗ, ಮಳೆ ಮತ್ತು ಸಮುದ್ರದ ಉಷ್ಣತೆ ನಾಲ್ಕನ್ನೂ ಒಟ್ಟಿಗೆ ನೋಡಿದಾಗ ಮಾತ್ರ ಪರಿಸರದ ಸಂಪೂರ್ಣ ಚಿತ್ರಣ ಸಿಗುತ್ತದೆ.`,
        takeaway: "ಮುಖ್ಯ ಅಂಶ: ಪ್ರತಿಯೊಂದು ವಿವರವನ್ನೂ ಸಾಕ್ಷ್ಯ ಕಾರ್ಡ್ ಮತ್ತು ನಕ್ಷೆಯೊಂದಿಗೆ ಪರಿಶೀಲಿಸಬಹುದು.",
      };
    }
    if (audience === "journalist") {
      return {
        placeLabel: placeName,
        title: `${placeName} ವರದಿ ಸಾರಾಂಶ: ದತ್ತಾಂಶ ಆಧಾರಿತ ಪರಿಸರ ವರದಿ`,
        body: `${periodText} (${bboxText}) NASA POWER ದಾಖಲೆಗಳ ಪ್ರಕಾರ ${placeName} ಪ್ರದೇಶದಲ್ಲಿ ${slopeText} (${pText}) ದರದ ಬದಲಾವಣೆ ಕಂಡುಬಂದಿದೆ. ನಾಲ್ಕು ಪರಿಸರ ಸೂಚಕಗಳಲ್ಲಿ ${fingerprint.significantCount}/4 ಸೂಚಕಗಳು ಸಂಖ್ಯಾಶಾಸ್ತ್ರೀಯವಾಗಿ ಮಹತ್ವದ್ದಾಗಿವೆ. ಒಂದೇ ಹವಾಮಾನ ವೈಪರೀತ್ಯವನ್ನು ದೀರ್ಘಕಾಲೀನ ಪ್ರವೃತ್ತಿ ಎಂದು ಭಾವಿಸದೆ ಸಾಕ್ಷ್ಯ ಕಾರ್ಡ್‌ನ ಮಿತಿಗಳನ್ನು ಉಲ್ಲೇಖಿಸುವುದು ಅಗತ್ಯ.`,
        takeaway: "ಪತ್ರಕರ್ತರ ಟಿಪ್ಪಣಿ: ಮೂಲ ಉಪಗ್ರಹ ದತ್ತಾಂಶ, ರೆಸಲ್ಯೂಶನ್ ಮತ್ತು ಮಿತಿಗಳನ್ನು ಸಾಕ್ಷ್ಯ ಕಾರ್ಡ್ ತೋರಿಸುತ್ತದೆ.",
      };
    }
    return {
      placeLabel: placeName,
      title: `${placeName}: ಸಂಖ್ಯಾಶಾಸ್ತ್ರೀಯ ಮತ್ತು ಬಹು-ಚರ ವಿಶ್ಲೇಷಣೆ`,
      body: `${placeName} (${bboxText}, ${periodText}) ಪ್ರದೇಶದ ${variable.name} ಪ್ರವೃತ್ತಿ ${slopeText} (${pText}, 95% CI: ${formatSignedNumber(stats.ciLow)} ರಿಂದ ${formatSignedNumber(stats.ciHigh)}) ಆಗಿದೆ. 4-ಚರ ಫಿಂಗರ್‌ಪ್ರಿಂಟ್‌ನಲ್ಲಿ ${fingerprint.significantCount}/4 ಅಂಶಗಳು α = 0.05 ಮಿತಿಯನ್ನು ದಾಟಿವೆ. ಟಿಪ್ಪಣಿ: ಲ್ಯಾಗ್-1 ಆಟೋಕೊರಿಲೇಷನ್ ತಿದ್ದುಪಡಿ ಇಲ್ಲಿ ಅನ್ವಯಿಸಿಲ್ಲ.`,
      takeaway: "ಸಂಶೋಧಕರ ಟಿಪ್ಪಣಿ: ಸಂಪೂರ್ಣ ಪ್ರಕರಣ ಕಡತವನ್ನು ನೋಟ್‌ಬುಕ್‌ನಿಂದ ಡೌನ್‌ಲೋಡ್ ಮಾಡಬಹುದು.",
    };
  }

  // English
  if (audience === "student") {
    return {
      placeLabel: placeName,
      title: `${placeName} in plain language`,
      body: useWesternGhatsCase
        ? `Across ${bboxText} (${periodText}), NASA's POWER record shows monsoon rainfall over the Western Ghats changing at ${slopeText} (${pText}). Reading land, rain, humidity, and wind together shows how coastal mountains and nearby seas push each other.`
        : `Across ${region.name} (${region.bboxLabel}, ${periodText}), NASA POWER tracked ${variable.name.toLowerCase()} changing at ${slopeText} (${pText}). Pairing land observations with the neighboring ocean reveals coupled patterns that a single variable would miss.`,
      takeaway: "Student takeaway: open the Evidence drawer below any card to trace every number to its NASA POWER source.",
    };
  }

  if (audience === "journalist") {
    return {
      placeLabel: placeName,
      title: `${placeName}: Evidence-backed reporting brief`,
      body: useWesternGhatsCase
        ? `NASA POWER (satellite + model agroclimatology, ~0.5° source grid) across ${bboxText} (${periodText}) shows monsoon rainfall changing at ${slopeText} (${pText}). Reporters should cite both the confidence interval and the missing-data caveats from the evidence card rather than treat single months as station readings.`
        : `NASA POWER composites over ${region.name} (${region.bboxLabel}, ${periodText}) record a ${slopeText} (${pText}) trend in ${variable.shortName}. ${fingerprint.coupledInsight} Journalists can cite dataset resolution, cloud-gap rates, and spatial variation directly from the Evidence card.`,
      takeaway: "Journalist brief: pair headline trend magnitude with spatial variation and limitations.",
    };
  }

  return {
    placeLabel: placeName,
    title: `${placeName}: Statistical & methodological digest`,
    body: useWesternGhatsCase
      ? `Western Ghats + Arabian Sea (${bboxText}, ${periodText}): NASA POWER PRECTOTCORR ${slopeText} (${pText}, 95% CI ${formatSignedNumber(stats.ciLow)} to ${formatSignedNumber(stats.ciHigh)}). Coupled fingerprint shows ${fingerprint.significantCount}/4 significant dimensions. NDVI/SST are not provided by NASA POWER and are intentionally excluded; lag-1 pre-whitening is not applied, so verify significance with a pre-whitened Mann–Kendall before causal attribution.`
      : `${region.name} (${region.bboxLabel}, ${periodText}): ${variable.name} OLS slope ${slopeText} (${pText}, 95% CI ${formatSignedNumber(stats.ciLow)} to ${formatSignedNumber(stats.ciHigh)}). Coupled fingerprint shows ${fingerprint.significantCount}/4 significant dimensions. ${fingerprint.investigationLead}`,
    takeaway: "Researcher note: export the reproducible Markdown or JSON case file from Notebook.",
  };
}

// D. One-Click Investigation Notebook Markdown Export
export function buildInvestigationMarkdown(params: {
  region: Region;
  point: [number, number] | null;
  researchQuestion: string;
  stats: TrendStats;
  fingerprint: RegionFingerprint;
  anomalies: AnomalyReport;
  evidence: EvidenceRecord;
  shareUrl: string;
  period?: [number, number];
  dataStatus?: string;
}): string {
  const {
    region,
    point,
    researchQuestion,
    stats,
    fingerprint,
    anomalies,
    evidence,
    shareUrl,
    period,
    dataStatus,
  } = params;
  const variable = getVariable(region.variable);
  const analysisPeriod = period ?? region.period;

  const fpLines = fingerprint.dimensions
    .map(
      (d) =>
        `- **${d.label}** (${d.dataset}): ${formatSignedNumber(d.slope)} ${d.slopeUnit} (${formatP(d.pValue)}, ${d.significant ? "significant" : "not significant"})`,
    )
    .join("\n");

  const anomalyLines = anomalies.events
    .map(
      (ev) =>
        `- **${ev.monthLabel}**: ${formatSignedNumber(ev.departure)} ${ev.unit} vs seasonal baseline (z = ${formatSignedNumber(ev.zScore)})`,
    )
    .join("\n");

  return [
    `# Earth System Trend Detective — Case File: ${region.name}`,
    ``,
    `## 1. Research Question`,
    `${researchQuestion || region.teaser}`,
    ``,
    `## 2. Selected Region & Bounding Box`,
    `- **Plate**: ${region.plate} — ${region.name} (${region.climate}, ${region.area})`,
    `- **Bounding Box**: ${region.bboxLabel}`,
    `- **Observation Period**: ${analysisPeriod[0]}–${analysisPeriod[1]}`,
    `- **Focused Point**: ${point ? formatCoords(point[0], point[1], 2) : "Regional composite (no single point pinned)"}`,
    `- **Data Status**: ${dataStatus || "Frontend demonstration series"}`,
    ``,
    `## 3. Variables & Datasets`,
    `- **Primary Variable**: ${variable.name} (${variable.shortName}, ${variable.unit})`,
    `- **Dataset**: ${evidence.dataset}`,
    `- **Source**: ${evidence.source}`,
    `- **Spatial Resolution**: ${evidence.spatialResolution}`,
    `- **Missing Data**: ${evidence.missingData}`,
    ``,
    `## 4. Analysis Methods`,
    `- Backend Theil–Sen slope + Mann–Kendall significance`,
    `- Seasonal cycle decomposition (12-month detrended baseline) for anomaly z-scores`,
    `- Multi-variable land–ocean trend fingerprint synthesis`,
    `- Local LLM (Ollama) narrates facts only; numbers are never changed by the model`,
    ``,
    `## 5. Results & Environmental Fingerprint`,
    `- **Headline Trend**: ${formatSlope(stats)} (${formatP(stats.pValue)}, 95% CI ${formatSignedNumber(stats.ciLow)} to ${formatSignedNumber(stats.ciHigh)})`,
    `- **Coupled Synthesis**: ${fingerprint.coupledInsight}`,
    `- **Next Investigation Lead**: ${fingerprint.investigationLead}`,
    ``,
    `### Fingerprint Dimensions`,
    fpLines,
    ``,
    `### Seasonal Anomalies`,
    anomalyLines,
    `> ${anomalies.cautionNote}`,
    ``,
    `## 6. Confidence & Limitations`,
    `- **Confidence Tier**: ${evidence.confidenceLevel}`,
    `- **Limitations**: ${evidence.limitations}`,
    ``,
    `## 7. Reproduce This Investigation`,
    `Shareable URL: ${shareUrl}`,
  ].join("\n");
}
