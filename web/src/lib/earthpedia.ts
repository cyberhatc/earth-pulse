export type Subject = "Earth observation" | "Atmosphere" | "Vegetation" | "Oceans" | "Analysis" | "Sources";

export interface Concept {
  slug: string;
  name: string;
  subject: Subject;
  summary: string;
  example: string;
  science: string;
  source: string;
  keywords?: string;
}

export const references = {
  sensing: ["NASA Earthdata", "https://www.earthdata.nasa.gov/learn/earth-observation-data-basics"],
  vegetation: ["NASA Earth Observatory", "https://science.nasa.gov/earth/earth-observatory/measuring-vegetation-ndvi-evi/"],
  power: ["NASA POWER", "https://power.larc.nasa.gov/"],
  oceans: ["NOAA Ocean Service", "https://oceanservice.noaa.gov/education/"],
  stats: ["NIST statistical handbook", "https://www.itl.nist.gov/div898/handbook/"],
  slope: ["SciPy Theil–Sen reference", "https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.theilslopes.html"],
  rank: ["USGS statistical methods", "https://pubs.usgs.gov/publication/tm4A3"],
  worldview: ["NASA Worldview", "https://worldview.earthdata.nasa.gov/"],
  firms: ["NASA FIRMS", "https://firms.modaps.eosdis.nasa.gov/"],
  sentinel: ["Microsoft Planetary Computer", "https://planetarycomputer.microsoft.com/dataset/sentinel-2-l2a"],
  noaa: ["NOAA Climate Data Online", "https://www.ncei.noaa.gov/cdo-web/"],
} satisfies Record<string, [string, string]>;

type Entry = [slug: string, name: string, summary: string, example: string, science: string, source: keyof typeof references, keywords?: string];
function group(subject: Subject, entries: Entry[]): Concept[] {
  return entries.map(([slug, name, summary, example, science, source, keywords]) => ({
    slug, name, subject, summary, example, science, source, keywords,
  }));
}

export const concepts = [
  ...group("Earth observation", [
    ["remote-sensing","Remote sensing","Learn about a surface from a distance.","A satellite can revisit a forest without a field team crossing it.","Sensors measure reflected sunlight or emitted energy in selected wavelength bands.","sensing","earth observation satellite imagery"],
    ["spatial-resolution","Spatial resolution","How small a feature can a map distinguish?","One grid cell can contain both a field and a village.","Pixel spacing and the sensor footprint limit the detail a measurement can resolve.","sensing"],
    ["temporal-resolution","Temporal resolution","How often does a new measurement arrive?","Monthly averages can hide a two-day heatwave.","Sampling frequency and the interval used for averaging describe different limits.","sensing","revisit time"],
    ["coverage","Data coverage","Which places and dates have usable records?","Cloud can hide a forest in an optical image.","A missing or masked value is unknown. Treating it as zero can bias averages.","sensing","missing gaps historical observations"],
    ["time-series","Time series","A sequence of values for one measure at one place.","Line up each June rainfall total to compare summers.","Regular sampling helps separate seasonal cycles from long-term change.","power","history historical observations charts"],
    ["coordinates","Geographical coordinates","Latitude and longitude identify a location.","Use a coastal point to compare the sea with a nearby inland cell.","Latitude measures angle north or south of the equator; longitude measures angle east or west of the reference meridian.","sensing"],
  ]),
];
