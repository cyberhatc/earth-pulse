import type { Region, Variable, VariableKey } from "./types";

export const VARIABLES: Record<VariableKey, Variable> = {
  lst: {
    key: "lst",
    name: "Air Temperature (2 m)",
    shortName: "Temp",
    unit: "°C",
    perDecadeUnit: "°C/decade",
    description:
      "Air temperature 2 m above the surface from NASA POWER (satellite + model agroclimatology). Tracks basins, plains, and coastal hills across heatwaves.",
    mission: "NASA POWER / T2M",
  },
  sea_ice: {
    key: "sea_ice",
    name: "Sea Surface & Cryosphere",
    shortName: "Sea Ice",
    unit: "million km²",
    perDecadeUnit: "million km²/decade",
    description:
      "Demonstrates a polar/marine thermal indicator. Not provided by NASA POWER — shown as a clearly-labelled demo variable only.",
    mission: "Not provided by NASA POWER",
  },
  ndvi: {
    key: "ndvi",
    name: "Vegetation Index",
    shortName: "NDVI",
    unit: "index",
    perDecadeUnit: "index/decade",
    description:
      "Canopy greenness from 0 (bare) to 1 (dense forest). Not provided by NASA POWER (intentionally NaN in the live store) — shown as a clearly-labelled demo variable only.",
    mission: "Not provided by NASA POWER",
  },
  water_extent: {
    key: "water_extent",
    name: "Surface Water Extent",
    shortName: "Water Extent",
    unit: "km²",
    perDecadeUnit: "km²/decade",
    description:
      "Rivers, reservoirs, estuaries, and inland basins. Not provided by NASA POWER (intentionally NaN in the live store) — shown as a clearly-labelled demo variable only.",
    mission: "Not provided by NASA POWER",
  },
  precipitation: {
    key: "precipitation",
    name: "Precipitation",
    shortName: "Rainfall",
    unit: "mm/month",
    perDecadeUnit: "mm/month/decade",
    description:
      "Average monthly precipitation from NASA POWER PRECTOTCORR (satellite + model). Along steep coastal escarpments, warming seas amplify convective bursts.",
    mission: "NASA POWER / PRECTOTCORR",
  },
};

export const REGIONS: Region[] = [
  {
    slug: "western-ghats",
    plate: "PLATE I",
    name: "Western Ghats + Arabian Sea",
    subtitle: "India · Monsoon–Ocean Margin",
    climate: "Tropical montane & Arabian Sea",
    area: "~1.1M km² (land–sea margin)",
    bboxLabel: "8°N–20°N, 70°E–78°E",
    variable: "precipitation",
    center: [14.0, 74.0],
    bounds: [
      [8.0, 70.0],
      [20.0, 78.0],
    ],
    zoom: 6,
    teaser:
      "How is Arabian Sea warming reshaping extreme monsoon rainfall along the Western Ghats?",
    trendShape: "up",
    baseline: 190,
    period: [2000, 2024],
  },
  {
    slug: "north-china-plain",
    plate: "PLATE II",
    name: "North China Plain + Bohai Sea",
    subtitle: "East Asia · Coastal Basin",
    climate: "Temperate monsoon & shallow sea",
    area: "~1.4M km² (plain & shelf sea)",
    bboxLabel: "30°N–42°N, 110°E–125°E",
    variable: "lst",
    center: [36.0, 117.5],
    bounds: [
      [30.0, 110.0],
      [42.0, 125.0],
    ],
    zoom: 5,
    teaser:
      "Why are North China Plain heatwaves and Bohai–Yellow Sea warming accelerating together?",
    trendShape: "up",
    baseline: 15.2,
    period: [2000, 2024],
  },
  {
    slug: "california-coast",
    plate: "PLATE III",
    name: "California Coast",
    subtitle: "North–South Dipole",
    climate: "Mediterranean upwelling dipole",
    area: "~480,000 km² (coastal corridor)",
    bboxLabel: "32°N–42°N, 122°W–117°W",
    variable: "ndvi",
    center: [37.0, -119.5],
    bounds: [
      [32.0, -122.0],
      [42.0, -117.0],
    ],
    zoom: 6,
    teaser:
      "Is the northern redwood–fog belt diverging from southern aridification across California?",
    trendShape: "down",
    baseline: 0.44,
    period: [2000, 2024],
  },
];

export function getRegion(slug: string): Region | undefined {
  return REGIONS.find((region) => region.slug === slug);
}

export function getVariable(key: VariableKey): Variable {
  return VARIABLES[key];
}

export function seeded(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function hashSlug(slug: string): number {
  let hash = 2166136261;
  for (let i = 0; i < slug.length; i += 1) {
    hash ^= slug.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
