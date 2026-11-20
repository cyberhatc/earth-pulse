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
  ...group("Analysis", [
    ["trend","Trend estimation","Which direction does a record move over time?","A series can warm over decades despite several cool years.","A slope gives the rate of change in measurement units per unit of time.","slope","getting warmer climate trends"],
    ["theil-sen","Theil–Sen estimator","Estimate the typical rate of change.","One extreme hot year can pull an ordinary fitted line upward.","The estimator takes the median of pairwise slopes and is resistant to isolated outliers.","slope","robust slope theil sen"],
    ["mann-kendall","Mann–Kendall test","Do later values tend to rank higher or lower?","A noisy rainfall record may show weak evidence for a consistent direction.","This rank test assesses a monotonic trend. Seasonality and autocorrelation affect interpretation.","rank","mann kendall significance"],
    ["significance","Statistical significance","How surprising is a result under a specified null model?","A tiny slope can be detectable in a long record.","A p-value depends on the model assumptions. It does not measure the size or cause of a change.","rank","p-value"],
    ["anomaly","Anomaly detection","Find a value unusual for its local context.","A wet July can be ordinary while the same rainfall in January is unusual.","The choice of reference period and seasonal baseline affects which observations stand out.","stats","outlier unusual measurement"],
    ["mad","Median absolute deviation","A typical distance from the middle of a sample.","One extreme reading barely shifts a robust spread estimate.","MAD is the median of absolute differences from the sample median.","stats","robust statistics"],
    ["forecast","Forecasting","Estimate what might happen over a chosen future period.","A twelve-month forecast extends a monthly series one year.","Forecast skill depends on the data, model and horizon. Future conditions can depart from past patterns.","stats","prediction model horizon"],
    ["uncertainty","Forecast uncertainty","How wide is the range of plausible future values?","A wide band makes a precise planning estimate harder.","P10 and P90 are estimated quantiles. P50 is the median. Actual coverage depends on calibration.","stats","p10 p50 p90 intervals prediction band"],
    ["climate-twins","Climate Twins","Find places with similar environmental profiles.","Two distant cells may share similar seasonal patterns.","K-means groups feature vectors by distance to cluster centers. Similarity depends on selected features and scaling.","stats","k-means clustering"],
    ["opposite-trends","Opposite Trend Detector","Look for neighboring cells changing in opposite directions.","One valley may green up while an adjacent cell browns.","Check slope strength, significance and data coverage before investigating a possible cause.","rank"],
  ]),
  ...group("Sources", [
    ["power","NASA POWER","Look up climate and solar-energy data at a location.","Compare monthly temperature at a chosen point.","POWER distributes gridded meteorological and solar products. A point query can represent a grid cell.","power","real data"],
    ["worldview","NASA Worldview and GIBS","Browse satellite imagery by date and layer.","Compare cloud cover on two dates.","GIBS serves imagery tiles. Their rendered colors depend on the product and legend.","worldview","satellite maps"],
    ["earthdata","NASA Earthdata","Discover Earth observation datasets and their documentation.","Check product coverage before choosing a starting year.","Product metadata records spatial extent, acquisition time, processing level and quality flags.","sensing"],
    ["sentinel","Sentinel-2 and Planetary Computer","Explore multispectral images of land and coastal water.","Compare red and near-infrared bands for vegetation.","Sentinel-2 L2A provides surface reflectance. Cloud masking and band resolution matter when comparing scenes.","sentinel","copernicus"],
    ["firms","NASA FIRMS","Find satellite detections of active fires and unusual heat.","Look for thermal detections during a regional fire event.","A detection represents a sensor footprint, with confidence and observation-time limitations.","firms"],
    ["noaa","NOAA Climate Data Online","Find historical weather records for comparison.","Check a nearby station’s rainfall history.","Station records sample particular locations. Compare units and observation periods with a gridded product.","noaa"],
  ]),
];
