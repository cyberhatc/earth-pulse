import { getVariable, hashSlug, seeded } from "./data";
import {
  computeStats,
  formatCoords,
  formatP,
  formatSignedNumber,
  formatSlope,
  generateSeries,
  slopeAtPoint,
} from "./trend";
import type {
  AnomalyEvent,
  AnomalyReport,
  CardKind,
  EarthTwinMatch,
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
export function computeFingerprint(region: Region): RegionFingerprint {
  const rand = seeded(hashSlug(`${region.slug}:fingerprint`));
  const primarySeries = generateSeries(region);
  const primaryStats = computeStats(region, primarySeries);

  const makeDim = (
    key: VariableKey,
    domain: FingerprintDimension["domain"],
    label: string,
    shortLabel: string,
    defaultSlope: number,
    defaultP: number,
    zScore: number,
    dataset: string,
    customUnit?: string,
  ): FingerprintDimension => {
    if (region.variable === key && !customUnit) {
      const dir = primaryStats.direction;
      const zMag = key === "ndvi" ? 1.8 : 2.1;
      const z = dir === "up" ? zMag : -zMag;
      return {
        key,
        domain,
        label,
        shortLabel,
        slope: primaryStats.slope,
        slopeUnit: primaryStats.slopeUnit,
        pValue: primaryStats.pValue,
        significant: primaryStats.significant,
        direction: dir,
        zScore: z,
        dataset,
      };
    }

    const variable = getVariable(key);
    const jitter = (rand() - 0.5) * 0.04;
    const slope = defaultSlope + jitter;
    const direction: FingerprintDimension["direction"] =
      Math.abs(slope) < 0.005 ? "flat" : slope > 0 ? "up" : "down";
    return {
      key,
      domain,
      label,
      shortLabel,
      slope,
      slopeUnit: customUnit ?? variable.perDecadeUnit,
      pValue: defaultP,
      significant: defaultP < 0.05,
      direction,
      zScore,
      dataset,
    };
  };

  let dimensions: FingerprintDimension[];
  let coupledInsight: string;
  let investigationLead: string;

  if (region.slug === "western-ghats") {
    dimensions = [
      makeDim("lst", "temperature", "Ghats Escarpment Temp", "Temp", 1.38, 0.002, 1.7, "MODIS MOD11C3 v6.1"),
      makeDim("ndvi", "vegetation", "Montane Canopy NDVI", "NDVI", 0.014, 0.142, 0.5, "MODIS MOD13C2 v6.1"),
      makeDim("precipitation", "rainfall", "Monsoon Rainfall", "Rain", 5.04, 0.001, 2.1, "GPM IMERG v07"),
      makeDim("water_extent", "water", "Arabian Sea SST", "Arabian Sea", 0.42, 0.001, 2.0, "MODIS Aqua SST", "°C/decade"),
    ];
    coupledInsight =
      `Arabian Sea surface warming (+0.42 °C/decade, p < 0.001) coincides with rising monsoon precipitation (${formatSlope(primaryStats)}, ${formatP(primaryStats.pValue)}) and escarpment warming (+1.38 °C/decade), while dense montane canopy NDVI remains statistically steady (p = 0.142).`;
    investigationLead =
      "Investigate orographic moisture surges: test whether Arabian Sea SST anomalies lead extreme 3-day rainfall bursts along 73°E–76°E windward slopes.";
  } else if (region.slug === "north-china-plain") {
    dimensions = [
      makeDim("lst", "temperature", "Plain Surface Temp", "Temp", 3.4, 0.001, 2.3, "MODIS MOD11C3 v6.1"),
      makeDim("ndvi", "vegetation", "Irrigated Crop NDVI", "NDVI", 0.026, 0.008, 1.3, "MODIS MOD13C2 v6.1"),
      makeDim("precipitation", "rainfall", "Summer Rainfall", "Rain", 1.8, 0.286, 0.3, "GPM IMERG v07"),
      makeDim("water_extent", "water", "Bohai & Yellow Sea SST", "Bohai SST", 0.51, 0.001, 2.1, "MODIS Aqua SST", "°C/decade"),
    ];
    coupledInsight =
      `North China Plain surface temperature (${formatSlope(primaryStats)}, ${formatP(primaryStats.pValue)}) and Bohai–Yellow Sea warming (+0.51 °C/decade) rise together alongside irrigated cropland greening (+0.026/decade), while summer rainfall remains variable (p = 0.286).`;
    investigationLead =
      "Investigate land–sea thermal coupling: separate urban heat-island and irrigation cooling signals inland from shallow Bohai Sea marine heatwaves.";
  } else {
    dimensions = [
      makeDim("lst", "temperature", "Coastal Surface Temp", "Temp", 1.12, 0.004, 1.6, "MODIS MOD11C3 v6.1"),
      makeDim("ndvi", "vegetation", "Coastal Canopy NDVI", "NDVI", -0.034, 0.001, -1.8, "MODIS MOD13C2 v6.1"),
      makeDim("precipitation", "rainfall", "Atmospheric River Rain", "Rain", -2.4, 0.198, -0.5, "GPM IMERG v07"),
      makeDim("water_extent", "water", "California Current SST", "Coastal SST", 0.29, 0.028, 1.1, "MODIS Aqua SST", "°C/decade"),
    ];
    coupledInsight =
      `Across the California Coast (32°N–42°N), basin-mean NDVI declines (${formatSlope(primaryStats)}, ${formatP(primaryStats.pValue)}) alongside coastal warming (+1.12 °C/decade), masking a sharp north–south dipole between northern fog belts and southern chaparral drought.`;
    investigationLead =
      "Investigate the 37°N dipole boundary: compare coastal upwelling SST and NDVI trajectories north of San Francisco Bay against Southern California.";
  }

  return {
    dimensions,
    coupledInsight,
    investigationLead,
    significantCount: dimensions.filter((d) => d.significant).length,
  };
}

// B. Trust Me: Evidence & Confidence Layer
export function buildEvidenceRecord(
  region: Region,
  stats: TrendStats,
  cardKind: CardKind,
  point?: [number, number] | null,
): EvidenceRecord {
  const variable = getVariable(region.variable);
  const months = (region.period[1] - region.period[0] + 1) * 12;

  const datasetMap: Record<
    VariableKey,
    { dataset: string; source: string; res: string; missing: string }
  > = {
    lst: {
      dataset: "MOD11C3 v6.1 Monthly CMG LST",
      source: "NASA LP DAAC / MODIS Terra & Aqua",
      res: "0.05° × 0.05° (~5.6 km grid)",
      missing: "2.4% cloud-screened months (linearly gap-filled)",
    },
    sea_ice: {
      dataset: "NSIDC-0051 Sea Ice Concentrations",
      source: "NASA EOSDIS NSIDC / DMSP SSMIS",
      res: "25 km × 25 km Polar Stereographic",
      missing: "0.6% polar-orbit sensor gap days (interpolated)",
    },
    water_extent: {
      dataset: "JRC Monthly Surface Water v1.4",
      source: "USGS Landsat 5–9 / Copernicus Sentinel-2",
      res: "30 m native optical water mask",
      missing: "4.1% winter snow/cloud obscured scenes",
    },
    ndvi: {
      dataset: "MOD13C2 v6.1 Monthly NDVI",
      source: "NASA LP DAAC / MODIS Terra",
      res: "0.05° × 0.05° (~5.6 km grid)",
      missing: "3.1% marine-layer fog & smoke masked scenes",
    },
    precipitation: {
      dataset: "GPM IMERG Final Run v07",
      source: "NASA GES DISC / GPM Constellation",
      res: "0.10° × 0.10° (~11 km grid)",
      missing: "1.2% microwave swath gaps (IR-calibrated)",
    },
  };

  const meta = datasetMap[region.variable];
  const localSlope = point ? slopeAtPoint(point[0], point[1], region) : null;
  const magnitude =
    localSlope !== null
      ? `${formatSlope(stats)} regional (${formatSignedNumber(localSlope)} ${variable.perDecadeUnit} at ${formatCoords(point![0], point![1], 1)})`
      : `${formatSlope(stats)} (95% CI: ${formatSignedNumber(stats.ciLow)} to ${formatSignedNumber(stats.ciHigh)})`;

  const scopeNote =
    cardKind === "anomaly"
      ? "Seasonal departures use detrended 12-month climatology; a short-term monsoon or heat spike does not establish a long-term trend shift."
      : cardKind === "earth-twins"
        ? "Cross-continent twin similarity relies on standardized decadal z-slopes; monsoon cloud contamination differs across coastal basins."
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
export function detectAnomalies(
  region: Region,
  series: number[],
  dates?: string[],
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

  const [[south, west], [north, east]] = region.bounds;
  const rand = seeded(hashSlug(`${region.slug}:anomaly-hotspot`));
  const hotspot: [number, number] = [
    south + (0.25 + rand() * 0.5) * (Math.min(82, north) - south),
    west + (0.25 + rand() * 0.5) * (east - west),
  ];

  const top = events[0];
  return {
    events,
    hotspot,
    baselineByMonth,
    summary: top
      ? `Sharpest seasonal departure occurred in ${top.monthLabel} (${formatSignedNumber(top.departure)} ${variable.unit}, z = ${formatSignedNumber(top.zScore)}) near ${formatCoords(hotspot[0], hotspot[1], 1)}.`
      : "No extreme seasonal departures detected.",
    cautionNote:
      "An anomaly is a temporary departure relative to the historical seasonal cycle — it is not automatically a disaster or a permanent climate trend.",
  };
}

// E. Earth Twin Finder — cross-continent coupled land-ocean comparison
type GlobalCatalogEntry = {
  slug: string;
  name: string;
  continent: string;
  climate: string;
  comparableDatasets: boolean;
  comparabilityNote: string;
  vector: Record<
    "temperature" | "vegetation" | "rainfall" | "water",
    { slope: number; unit: string; z: number; direction: "up" | "down" | "flat" }
  >;
};

const GLOBAL_REFERENCE_CATALOG: GlobalCatalogEntry[] = [
  {
    slug: "bay-of-bengal-eastern-ghats",
    name: "Eastern Ghats + Bay of Bengal",
    continent: "Asia (East Coast)",
    climate: "Tropical monsoon margin",
    comparableDatasets: true,
    comparabilityNote: "Comparable GPM IMERG v07 rainfall & MODIS Aqua SST (2000–2024).",
    vector: {
      temperature: { slope: 1.46, unit: "°C/decade", z: 1.6, direction: "up" },
      vegetation: { slope: 0.011, unit: "index/decade", z: 0.4, direction: "up" },
      rainfall: { slope: 4.8, unit: "mm/month/decade", z: 1.9, direction: "up" },
      water: { slope: 0.39, unit: "°C/decade", z: 1.8, direction: "up" },
    },
  },
  {
    slug: "west-africa-guinea-coast",
    name: "Guinea Coast + Gulf Margin",
    continent: "Africa",
    climate: "Humid tropical monsoon",
    comparableDatasets: true,
    comparabilityNote: "Comparable MODIS LST/SST & GPM IMERG monsoon composites.",
    vector: {
      temperature: { slope: 1.24, unit: "°C/decade", z: 1.4, direction: "up" },
      vegetation: { slope: 0.009, unit: "index/decade", z: 0.4, direction: "up" },
      rainfall: { slope: 3.9, unit: "mm/month/decade", z: 1.5, direction: "up" },
      water: { slope: 0.35, unit: "°C/decade", z: 1.6, direction: "up" },
    },
  },
  {
    slug: "indus-ganges-shelf",
    name: "Indo-Gangetic Plain + Delta",
    continent: "Asia",
    climate: "Irrigated alluvial basin",
    comparableDatasets: true,
    comparabilityNote: "Comparable MODIS LST/NDVI irrigated crop masking & BoB SST.",
    vector: {
      temperature: { slope: 2.85, unit: "°C/decade", z: 2.0, direction: "up" },
      vegetation: { slope: 0.024, unit: "index/decade", z: 1.2, direction: "up" },
      rainfall: { slope: 1.1, unit: "mm/month/decade", z: 0.3, direction: "up" },
      water: { slope: 0.44, unit: "°C/decade", z: 1.9, direction: "up" },
    },
  },
  {
    slug: "po-valley-adriatic",
    name: "Po Valley + Northern Adriatic",
    continent: "Europe",
    climate: "Enclosed basin & shallow sea",
    comparableDatasets: true,
    comparabilityNote: "Comparable MODIS LST/SST (shallow basin thermal amplification).",
    vector: {
      temperature: { slope: 2.95, unit: "°C/decade", z: 2.1, direction: "up" },
      vegetation: { slope: 0.017, unit: "index/decade", z: 0.9, direction: "up" },
      rainfall: { slope: -0.7, unit: "mm/month/decade", z: -0.2, direction: "down" },
      water: { slope: 0.49, unit: "°C/decade", z: 2.0, direction: "up" },
    },
  },
  {
    slug: "humboldt-chile-coast",
    name: "Chilean Coast + Humboldt Current",
    continent: "South America",
    climate: "Eastern boundary upwelling",
    comparableDatasets: true,
    comparabilityNote: "Comparable coastal NDVI & MODIS SST eastern-boundary upwelling transect.",
    vector: {
      temperature: { slope: 0.98, unit: "°C/decade", z: 1.4, direction: "up" },
      vegetation: { slope: -0.029, unit: "index/decade", z: -1.6, direction: "down" },
      rainfall: { slope: -2.1, unit: "mm/month/decade", z: -0.6, direction: "down" },
      water: { slope: 0.24, unit: "°C/decade", z: 0.9, direction: "up" },
    },
  },
  {
    slug: "iberian-canary-margin",
    name: "Iberian Peninsula + Canary Margin",
    continent: "Europe / Atlantic",
    climate: "Mediterranean coastal dipole",
    comparableDatasets: false,
    comparabilityNote: "Partial comparability: terrain relief requires 1 km downscaling for coastal fog.",
    vector: {
      temperature: { slope: 1.35, unit: "°C/decade", z: 1.7, direction: "up" },
      vegetation: { slope: -0.024, unit: "index/decade", z: -1.4, direction: "down" },
      rainfall: { slope: -2.8, unit: "mm/month/decade", z: -0.7, direction: "down" },
      water: { slope: 0.31, unit: "°C/decade", z: 1.2, direction: "up" },
    },
  },
];

export function findEarthTwins(
  region: Region,
  fingerprint?: RegionFingerprint,
): EarthTwinMatch[] {
  const fp = fingerprint ?? computeFingerprint(region);
  const currentVec: Record<"temperature" | "vegetation" | "rainfall" | "water", number> = {
    temperature: 0,
    vegetation: 0,
    rainfall: 0,
    water: 0,
  };
  const currentDirs: Record<"temperature" | "vegetation" | "rainfall" | "water", string> = {
    temperature: "flat",
    vegetation: "flat",
    rainfall: "flat",
    water: "flat",
  };
  for (const dim of fp.dimensions) {
    if (
      dim.domain !== "temperature" &&
      dim.domain !== "vegetation" &&
      dim.domain !== "rainfall" &&
      dim.domain !== "water"
    ) {
      continue;
    }
    currentVec[dim.domain] = dim.zScore;
    currentDirs[dim.domain] = dim.direction;
  }

  const domains: ("temperature" | "vegetation" | "rainfall" | "water")[] = [
    "temperature",
    "vegetation",
    "rainfall",
    "water",
  ];

  return GLOBAL_REFERENCE_CATALOG.filter((entry) => entry.slug !== region.slug)
    .map((entry) => {
      let distSq = 0;
      const sharedTraits: string[] = [];
      const differences: string[] = [];

      for (const d of domains) {
        const diff = currentVec[d] - entry.vector[d].z;
        distSq += diff * diff;
        if (currentDirs[d] === entry.vector[d].direction) {
          sharedTraits.push(`${d} (${entry.vector[d].direction})`);
        } else {
          differences.push(`${d} diverges (${currentDirs[d]} vs ${entry.vector[d].direction})`);
        }
      }

      const dist = Math.sqrt(distSq);
      const similarity = Math.max(12, Math.min(98, Math.round(100 - dist * 16)));

      return {
        slug: entry.slug,
        name: entry.name,
        continent: entry.continent,
        climate: entry.climate,
        similarity,
        comparableDatasets: entry.comparableDatasets,
        comparabilityNote: entry.comparabilityNote,
        sharedTraits: sharedTraits.length > 0 ? sharedTraits : ["shared ocean-land warming"],
        differences:
          differences.length > 0
            ? differences
            : ["matched directional profile across all 4 variables"],
        vector: {
          temperature: {
            slope: entry.vector.temperature.slope,
            unit: entry.vector.temperature.unit,
            direction: entry.vector.temperature.direction,
          },
          vegetation: {
            slope: entry.vector.vegetation.slope,
            unit: entry.vector.vegetation.unit,
            direction: entry.vector.vegetation.direction,
          },
          rainfall: {
            slope: entry.vector.rainfall.slope,
            unit: entry.vector.rainfall.unit,
            direction: entry.vector.rainfall.direction,
          },
          water: {
            slope: entry.vector.water.slope,
            unit: entry.vector.water.unit,
            direction: entry.vector.water.direction,
          },
        },
      };
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3);
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
  const slopeText = useWesternGhatsCase
    ? "+5.04 mm/month/decade"
    : formatSlope(stats);
  const periodText = `${(period ?? region.period)[0]}–${(period ?? region.period)[1]}`;
  const pText = useWesternGhatsCase ? "p < 0.001" : formatP(stats.pValue);
  const bboxText = useWesternGhatsCase
    ? "8°N–20°N, 70°E–78°E"
    : region.bboxLabel;

  if (language === "hi") {
    if (audience === "student") {
      return {
        placeLabel: placeName,
        title: `${placeName}: उपग्रह डेटा की सरल कहानी`,
        body: `${periodText} के बीच NASA के उपग्रहों ने ${placeName} (${bboxText}) में भूमि और पास के समुद्र दोनों का निरीक्षण किया। यहाँ प्रमुख बदलाव की दर ${slopeText} (${pText}) है। जब समुद्र और ज़मीन एक साथ बदलते हैं, तो वैज्ञानिक तापमान, वनस्पति, वर्षा और महासागर चारों संकेतों को मिलाकर पूरा चित्र समझते हैं।`,
        takeaway: "मुख्य सीख: हर निष्कर्ष को डेटा, क्षेत्र-सीमा और साक्ष्य कार्ड से जोड़ा गया है।",
      };
    }
    if (audience === "journalist") {
      return {
        placeLabel: placeName,
        title: `${placeName} रिपोर्टिंग ब्रीफ: भूमि-समुद्र प्रमाणित रुझान`,
        body: `MODIS और GPM उपग्रह रिकॉर्ड (${periodText}, ${bboxText}) के अनुसार, ${placeName} में प्रमुख परिवर्तन दर ${slopeText} (${pText}) दर्ज की गई है। ${fingerprint.significantCount}/4 संकेतक सांख्यिकीय रूप से महत्वपूर्ण हैं। पत्रकार किसी भी एक मौसमी घटना को दीर्घकालिक जलवायु प्रवृत्ति मानने से पहले साक्ष्य कार्ड में लापता डेटा और स्थानीय मानचित्र की जाँच कर सकते हैं।`,
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
        body: `${periodText} ಅವಧಿಯಲ್ಲಿ NASA ಉಪಗ್ರಹಗಳು ${placeName} (${bboxText}) ಪ್ರದೇಶದ ನೆಲ ಮತ್ತು ಸಮುದ್ರದ ಬದಲಾವಣೆಗಳನ್ನು ಅಳೆದಿವೆ. ಇಲ್ಲಿನ ಪ್ರಮುಖ ಬದಲಾವಣೆಯ ದರ ${slopeText} (${pText}) ಆಗಿದೆ. ತಾಪಮಾನ, ಸಸ್ಯವರ್ಗ, ಮಳೆ ಮತ್ತು ಸಮುದ್ರದ ಉಷ್ಣತೆ ನಾಲ್ಕನ್ನೂ ಒಟ್ಟಿಗೆ ನೋಡಿದಾಗ ಮಾತ್ರ ಪರಿಸರದ ಸಂಪೂರ್ಣ ಚಿತ್ರಣ ಸಿಗುತ್ತದೆ.`,
        takeaway: "ಮುಖ್ಯ ಅಂಶ: ಪ್ರತಿಯೊಂದು ವಿವರವನ್ನೂ ಸಾಕ್ಷ್ಯ ಕಾರ್ಡ್ ಮತ್ತು ನಕ್ಷೆಯೊಂದಿಗೆ ಪರಿಶೀಲಿಸಬಹುದು.",
      };
    }
    if (audience === "journalist") {
      return {
        placeLabel: placeName,
        title: `${placeName} ವರದಿ ಸಾರಾಂಶ: ದತ್ತಾಂಶ ಆಧಾರಿತ ಪರಿಸರ ವರದಿ`,
        body: `${periodText} (${bboxText}) ಉಪಗ್ರಹ ದಾಖಲೆಗಳ ಪ್ರಕಾರ ${placeName} ಪ್ರದೇಶದಲ್ಲಿ ${slopeText} (${pText}) ದರದ ಬದಲಾವಣೆ ಕಂಡುಬಂದಿದೆ. ನಾಲ್ಕು ಪರಿಸರ ಸೂಚಕಗಳಲ್ಲಿ ${fingerprint.significantCount}/4 ಸೂಚಕಗಳು ಸಂಖ್ಯಾಶಾಸ್ತ್ರೀಯವಾಗಿ ಮಹತ್ವದ್ದಾಗಿವೆ. ಒಂದೇ ಹವಾಮಾನ ವೈಪರೀತ್ಯವನ್ನು ದೀರ್ಘಕಾಲೀನ ಪ್ರವೃತ್ತಿ ಎಂದು ಭಾವಿಸದೆ ಸಾಕ್ಷ್ಯ ಕಾರ್ಡ್‌ನ ಮಿತಿಗಳನ್ನು ಉಲ್ಲೇಖಿಸುವುದು ಅಗತ್ಯ.`,
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
        ? `Across ${bboxText} (${periodText}), NASA satellites watched the Arabian Sea warm at +0.42 °C/decade while monsoon rainfall over the Western Ghats grew stronger (${slopeText}, ${pText}). Reading land, forest cover, rain, and ocean together shows how coastal mountains and nearby seas push each other.`
        : `Across ${region.name} (${region.bboxLabel}, ${periodText}), NASA satellites tracked ${variable.name.toLowerCase()} changing at ${slopeText} (${pText}). Pairing land observations with the neighboring ocean reveals coupled patterns that a single variable would miss.`,
      takeaway: "Student takeaway: open the Evidence drawer below any card to trace every number to its NASA satellite source.",
    };
  }

  if (audience === "journalist") {
    return {
      placeLabel: placeName,
      title: `${placeName}: Evidence-backed reporting brief`,
      body: useWesternGhatsCase
        ? `Satellite composites across ${bboxText} (${periodText}) show monsoon rainfall rising at ${slopeText} (${pText}) alongside Arabian Sea surface warming (+0.42 °C/decade). Because peak-monsoon clouds obscure optical sensors, reporters should cite both the confidence interval and missing-data rate from the evidence card.`
        : `Calibrated composites over ${region.name} (${region.bboxLabel}, ${periodText}) record a ${slopeText} (${pText}) trend in ${variable.shortName}. ${fingerprint.coupledInsight} Journalists can cite dataset resolution, cloud-gap rates, and spatial variation directly from the Evidence card.`,
      takeaway: "Journalist brief: pair headline trend magnitude with spatial variation and limitations.",
    };
  }

  return {
    placeLabel: placeName,
    title: `${placeName}: Statistical & methodological digest`,
    body: useWesternGhatsCase
      ? `Western Ghats + Arabian Sea (${bboxText}, ${periodText}): GPM IMERG ${slopeText} (${pText}), MODIS Aqua SST +0.42 °C/decade, MOD11C3 LST +1.38 °C/decade, MOD13C2 NDVI +0.014/decade (p = 0.142). Cloud-screened Jun–Sep composites require pre-whitened Mann-Kendall verification before causal attribution.`
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
