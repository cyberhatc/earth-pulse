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
    desc: "On India's west coast, a narrow coastal plain rises into the forested Western Ghats.",
    context: "How does monsoon rainfall differ between the coast and the hills?",
    landscape: "Escarpments, tropical forests, plateaus, river basins, and coastal plains.",
    variables:
      "Precipitation, temperature, humidity, NDVI/vegetation condition, wind, and nearby sea-surface conditions where relevant.",
    image: {
      src: "/atlas/western-ghats.jpg",
      alt: "Western Indian coastline with the Arabian Sea west of the forested Ghats",
      credit: "Esri World Imagery and contributing providers",
      href: "https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9",
    },
  },
  "north-china-plain": {
    label: "REGION 02",
    bbox: "30°N–42°N, 110°E–125°E",
    desc: "Rivers cross a low, heavily farmed plain on their way to the Bohai and Yellow Seas.",
    context: "Do crops green up at the same time inland and near the coast?",
    landscape: "Lowland plains, river deltas, megacity corridors, and semi-enclosed seas.",
    variables:
      "Temperature, precipitation, humidity, wind, solar radiation, vegetation indices, and coastal/ocean parameters where applicable.",
    image: {
      src: "/atlas/north-china-plain.jpg",
      alt: "Eastern China showing the North China Plain and the Bohai Sea",
      credit: "Esri World Imagery and contributing providers",
      href: "https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9",
    },
  },
  "california-coast": {
    label: "REGION 03",
    bbox: "32°N–42°N, 122°W–117°W",
    desc: "The Pacific meets coastal mountains, with agricultural valleys sheltered farther inland.",
    context: "How far inland does the moderating influence of the ocean reach?",
    landscape: "Pacific coastline, coastal ranges, valleys, chaparral, and agricultural/urban mosaics.",
    variables:
      "Temperature, precipitation, humidity, wind, NDVI, and sea-surface/ocean-related indicators where relevant.",
    image: {
      src: "/atlas/california-coast.jpg",
      alt: "Pacific coast of California with coastal ranges and inland valleys",
      credit: "Esri World Imagery and contributing providers",
      href: "https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9",
    },
  },
};

export function RegionsSection() {
  return (
    <section id="regions" className="landing-section l-regions" data-section="regions" aria-label="Study regions">
      <div className="landing-shell">
        <div className="l-section-head" data-l-reveal>
          <p className="l-eyebrow" data-anime="mark">Study regions</p>
          <h2 className="l-section-title">Three coasts, three questions</h2>
          <p className="l-section-lede">
            Choose a coast and compare it with the land behind it. Each question is a starting point for an investigation.
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
                    Regional satellite mosaic.{" "}
                    <a href={detail.image.href} target="_blank" rel="noreferrer">
                      {detail.image.credit}
                    </a>
                  </figcaption>
                </figure>
                <div className="l-region-body">
                  <h3>{region.name}</h3>
                  <p className="l-region-bbox"><strong>Bounding box:</strong> {detail.bbox}</p>
                  <p>{detail.desc}</p>
                  <p><strong>Investigation question</strong><br /> {detail.context}</p>
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