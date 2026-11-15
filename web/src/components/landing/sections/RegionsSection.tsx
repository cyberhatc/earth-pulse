import { Link } from "react-router-dom";
import { REGIONS } from "../../../lib/data";

const REGION_DETAILS: Record<
  string,
  {
    label: string;
    bbox: string;
    desc: string;
    context: string;
    landscape: string;
    variables: string;
    image: { src: string; alt: string; credit: string; href: string };
  }
> = {
  "western-ghats": {
    label: "REGION 01",
    bbox: "8°N–20°N, 70°E–78°E",
    desc: "A steep, biodiversity-rich mountain range along India's western margin adjacent to the Arabian Sea, with strong monsoon influence, complex orography, and varied land cover.",
    context:
      "Seasonal rainfall gradients, coastal–inland contrasts, and elevation effects can shape temperature, moisture, and vegetation signals.",
    landscape: "Escarpments, tropical forests, plateaus, river basins, and coastal plains.",
    variables:
      "Precipitation, temperature, humidity, NDVI/vegetation condition, wind, and nearby sea-surface conditions where relevant.",
    image: {
      src: "https://images-assets.nasa.gov/image/iss036e022303/iss036e022303~orig.jpg",
      alt: "Orbital view representing the Western Ghats and Arabian Sea region (illustrative geographical context).",
      credit: "NASA Image and Video Library (ISS036-E-022303)",
      href: "https://images.nasa.gov/details/iss036e022303",
    },
  },
  "north-china-plain": {
    label: "REGION 02",
    bbox: "30°N–42°N, 110°E–125°E",
    desc: "A broad, densely populated alluvial plain connected to major river systems and bordered by the Bohai and Yellow Seas.",
    context:
      "Continental seasonality, irrigation and land-use intensity, coastal processes, and atmospheric conditions.",
    landscape: "Lowland plains, river deltas, megacity corridors, and semi-enclosed seas.",
    variables:
      "Temperature, precipitation, humidity, wind, solar radiation, vegetation indices, and coastal/ocean parameters where applicable.",
    image: {
      src: "https://images-assets.nasa.gov/image/PIA12063/PIA12063~orig.jpg",
      alt: "Satellite view representing the North China Plain and Bohai/Yellow Sea coastal context (illustrative).",
      credit: "NASA Image and Video Library (PIA12063)",
      href: "https://images.nasa.gov/details/PIA12063",
    },
  },
  "california-coast": {
    label: "REGION 03",
    bbox: "32°N–42°N, 122°W–117°W",
    desc: "A diverse coastal margin spanning Mediterranean-climate zones, upwelling-influenced waters, mountain ranges, valleys, and urbanized shorelines.",
    context:
      "Marine influence, drought and precipitation variability, vegetation responses, and coastal circulation.",
    landscape: "Pacific coastline, coastal ranges, valleys, chaparral, and agricultural/urban mosaics.",
    variables:
      "Temperature, precipitation, humidity, wind, NDVI, and sea-surface/ocean-related indicators where relevant.",
    image: {
      src: "https://images-assets.nasa.gov/image/PIA11066/PIA11066~orig.jpg",
      alt: "Satellite view representing the California coastal region (illustrative geographical context).",
      credit: "NASA Image and Video Library (PIA11066)",
      href: "https://images.nasa.gov/details/PIA11066",
    },
  },
};

export function RegionsSection() {
  return (
    <section id="regions" className="landing-section l-regions" data-section="regions" aria-label="Study regions">
      <div className="landing-shell">
        <div className="l-section-head" data-l-reveal>
          <p className="l-eyebrow" data-anime="mark">Study regions</p>
          <h2 className="l-section-title">Three contrasting geographical case files</h2>
          <p className="l-section-lede">
            Explore three contrasting geographical contexts. Descriptions provide geographic and investigative context
            only—no trend findings or statistics are claimed here.
          </p>
        </div>

        <div className="l-region-list" data-l-stagger>
          {REGIONS.map((region) => {
            const detail = REGION_DETAILS[region.slug];
            if (!detail) return null;
            return (
              <article key={region.slug} className="l-region-case" data-anime="accent">
                <figure className="l-region-figure">
                  <span className="l-region-badge">{detail.label}</span>
                  <span className="l-region-coord-chip">{detail.bbox}</span>
                  <img src={detail.image.src} alt={detail.image.alt} loading="lazy" decoding="async" />
                  <figcaption>
                    Representative imagery (not an exact bounding-box capture).{" "}
                    <a href={detail.image.href} target="_blank" rel="noreferrer">
                      {detail.image.credit}
                    </a>
                  </figcaption>
                </figure>
                <div className="l-region-body">
                  <h3>{region.name}</h3>
                  <p className="l-region-bbox"><strong>Bounding box:</strong> {detail.bbox}</p>
                  <p>{detail.desc}</p>
                  <p><strong>Environmental context:</strong> {detail.context}</p>
                  <dl className="l-region-meta">
                    <div>
                      <dt>Landscape</dt>
                      <dd>{detail.landscape}</dd>
                    </div>
                    <div>
                      <dt>Potential variables</dt>
                      <dd>{detail.variables}</dd>
                    </div>
                  </dl>
                  <Link to={`/region/${region.slug}`} className="l-btn-secondary l-region-cta">
                    Open {region.name} case file
                  </Link>
                </div>
              </article>
            );
          })}
        </div>

        <p className="l-note-inline" data-l-reveal>
          Region imagery is used for geographical context and may not correspond to the exact bounding box. No
          environmental trend results are implied on this page.
        </p>
      </div>
    </section>
  );
}