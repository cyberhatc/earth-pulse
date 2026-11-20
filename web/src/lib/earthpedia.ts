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
  ...group("Atmosphere", [
    ["temperature","Temperature","How hot is the air or surface?","Compare average July temperatures across years.","Air and land-surface temperatures measure different physical quantities.","power","heat warming"],
    ["humidity","Humidity","How much moisture is in the air?","A humid afternoon can feel hotter.","Relative humidity compares vapor pressure with saturation at the same temperature.","power"],
    ["wind","Wind","Air moving across the surface.","Compare coastal breeze speeds across seasons.","Speed alone cannot tell you which direction air came from.","power"],
    ["precipitation","Precipitation","Water falling as rain or snow.","Compare monsoon totals with earlier monsoon seasons.","An accumulated depth and a daily rate must use compatible time units.","power","rainfall wet drought"],
    ["solar-radiation","Solar radiation","How much sunlight reaches the surface?","Cloud cover can reduce incoming sunlight.","Surface irradiance measures radiant power per area; energy totals integrate that power over time.","power"],
    ["seasonality","Seasonal variability","A pattern that returns at a similar time each year.","Rain often increases during the monsoon.","Compare like months before interpreting a difference as a trend.","power"],
  ]),
  ...group("Vegetation", [
    ["ndvi","NDVI","A measure of how green the land looks to a satellite.","Compare a field before and after the growing season.","The normalized difference vegetation index divides near-infrared minus red reflectance by their sum. Cloud and soil affect the result.","vegetation","how green is the land plants plant health"],
    ["land-cover","Land cover","What physically covers the ground?","A single pixel may contain forest, water and pasture.","Land cover describes surface material; land use describes what people do there.","sensing","forest agriculture land-use change"],
    ["greenness","Vegetation greenness","How strongly the surface shows the spectral signature of green leaves.","Leaf growth can raise a field’s NDVI after rain.","Greenness varies with canopy density, leaf properties and background soil.","vegetation"],
  ]),
  ...group("Oceans", [
    ["sst","Sea surface temperature","How warm is the ocean near its surface?","Cold water rising along California can cool coastal waters.","Satellite and in-water measurements can represent different depths and times.","oceans","ocean heat upwelling"],
    ["sea-level","Sea level","The height of the ocean relative to a reference.","A coastal tide gauge records local changes in water height.","Tides, currents and vertical land movement complicate local trend interpretation.","oceans"],
    ["coastal-climate","Coastal climate","How do land and water influence nearby weather?","Compare a coastal cell with a valley farther inland.","Water stores heat differently from land. Wind, terrain and currents also influence regional differences.","oceans","ocean atmosphere interactions"],
  ]),
];
