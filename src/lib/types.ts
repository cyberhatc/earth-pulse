export type VariableKey =
  | "lst"
  | "sea_ice"
  | "ndvi"
  | "water_extent"
  | "precipitation";

export type TrendShape = "up" | "down";

export type Variable = {
  key: VariableKey;
  name: string;
  shortName: string;
  unit: string;
  perDecadeUnit: string;
  description: string;
  mission: string;
};

export type Region = {
  slug: string;
  plate: string;
  name: string;
  subtitle: string;
  climate: string;
  area: string;
  bboxLabel: string;
  variable: VariableKey;
  center: [number, number]; // lat, lng
  bounds: [[number, number], [number, number]]; // [[south, west], [north, east]]
  zoom: number;
  teaser: string;
  trendShape: TrendShape;
  baseline: number;
  period: [number, number];
};

export type TrendStats = {
  slope: number; // per decade
  slopeUnit: string;
  pValue: number;
  significant: boolean;
  ciLow: number;
  ciHigh: number;
  direction: "up" | "down" | "flat";
};

export type CardKind =
  | "finding"
  | "trend-chart"
  | "slope-map"
  | "variable"
  | "caveat"
  | "fingerprint"
  | "anomaly"
  | "earth-twins"
  | "story"
  | "evidence";

export type CanvasCard = {
  id: string;
  kind: CardKind;
  createdAt: number;
  point?: [number, number];
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  cardKind?: CardKind;
  cardId?: string;
};

export type StoryLanguage = "en" | "hi" | "kn";
export type StoryAudience = "student" | "journalist" | "researcher";

export type FingerprintDimension = {
  key: VariableKey;
  domain: "temperature" | "vegetation" | "rainfall" | "water";
  label: string;
  shortLabel: string;
  slope: number;
  slopeUnit: string;
  pValue: number;
  significant: boolean;
  direction: "up" | "down" | "flat";
  zScore: number;
  dataset: string;
};

export type RegionFingerprint = {
  dimensions: FingerprintDimension[];
  coupledInsight: string;
  investigationLead: string;
  significantCount: number;
};

export type EvidenceRecord = {
  dataset: string;
  source: string;
  observationPeriod: string;
  spatialResolution: string;
  trendMagnitude: string;
  statisticalSignificance: string;
  missingData: string;
  confidenceLevel: "High" | "Moderate" | "Low";
  limitations: string;
};

export type AnomalyEvent = {
  index: number;
  year: number;
  month: number;
  monthLabel: string;
  value: number;
  baselineValue: number;
  departure: number;
  zScore: number;
  unit: string;
};

export type AnomalyReport = {
  events: AnomalyEvent[];
  hotspot: [number, number];
  baselineByMonth: number[];
  summary: string;
  cautionNote: string;
};

export type EarthTwinMatch = {
  slug: string;
  name: string;
  continent: string;
  climate: string;
  similarity: number;
  comparableDatasets: boolean;
  comparabilityNote: string;
  sharedTraits: string[];
  differences: string[];
  vector: Record<
    "temperature" | "vegetation" | "rainfall" | "water",
    { slope: number; unit: string; direction: "up" | "down" | "flat" }
  >;
};
