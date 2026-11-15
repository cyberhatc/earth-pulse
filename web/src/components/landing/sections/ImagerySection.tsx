const GALLERY = [
  {
    title: "Global Earth observation",
    caption: "A whole-Earth perspective supports understanding coupled land, ocean, atmosphere, and ice systems.",
    src: "https://images-assets.nasa.gov/image/PIA03377/PIA03377~orig.jpg",
    alt: "NASA Blue Marble-style global view of Earth showing land, oceans, clouds, and ice.",
    credit: "NASA Image and Video Library",
    href: "https://images.nasa.gov/details/PIA03377",
  },
  {
    title: "Vegetation and land cover",
    caption: "Vegetation indices and optical imagery help reveal greenness patterns and land-surface change over time.",
    src: "https://images-assets.nasa.gov/image/GSFC_20171208_Archive_e001963/GSFC_20171208_Archive_e001963~orig.jpg",
    alt: "Satellite view highlighting vegetation and land cover patterns.",
    credit: "NASA / GSFC (NASA Image and Video Library)",
    href: "https://images.nasa.gov/details/GSFC_20171208_Archive_e001963",
  },
  {
    title: "Ocean and sea-surface conditions",
    caption: "Ocean observations inform sea-surface conditions, circulation context, and coastal–marine interactions.",
    src: "https://images-assets.nasa.gov/image/PIA02688/PIA02688~orig.jpg",
    alt: "Satellite view of ocean color and coastal waters.",
    credit: "NASA Image and Video Library",
    href: "https://images.nasa.gov/details/PIA02688",
  },
  {
    title: "Precipitation and atmosphere",
    caption: "Atmospheric observations support analysis of storms, moisture, and precipitation-related variability.",
    src: "https://images-assets.nasa.gov/image/GSFC_20171208_Archive_e000975/GSFC_20171208_Archive_e000975~orig.jpg",
    alt: "Satellite view of atmospheric cloud and precipitation systems.",
    credit: "NASA / GSFC (NASA Image and Video Library)",
    href: "https://images.nasa.gov/details/GSFC_20171208_Archive_e000975",
  },
  {
    title: "Coastal change and land use",
    caption: "Satellite imagery provides context for coastal interfaces, development patterns, and landscape transitions.",
    src: "https://images-assets.nasa.gov/image/PIA12063/PIA12063~orig.jpg",
    alt: "Satellite view of coastal and land-use patterns.",
    credit: "NASA Image and Video Library",
    href: "https://images.nasa.gov/details/PIA12063",
  },
  {
    title: "Orbital Earth observation",
    caption: "Orbital platforms capture multi-scale views used to investigate regional environmental systems.",
    src: "https://images-assets.nasa.gov/image/iss036e022303/iss036e022303~orig.jpg",
    alt: "Earth observation image captured from orbit showing regional geography.",
    credit: "NASA Image and Video Library (ISS/NASA)",
    href: "https://images.nasa.gov/details/iss036e022303",
  },
];

export function ImagerySection() {
  return (
    <section id="imagery" className="landing-section l-imagery" data-section="imagery" aria-label="Satellite imagery gallery">
      <div className="landing-shell">
        <div className="l-section-head" data-l-reveal>
          <p className="l-eyebrow" data-anime="mark">Imagery</p>
          <h2 className="l-section-title">Satellite imagery gallery</h2>
          <p className="l-section-lede">
            Curated editorial gallery using verified NASA imagery for visual orientation. Images provide geographical or
            observational context — <strong>not</strong> presented as direct, location-specific measurements produced by
            this app unless explicitly labeled inside the application.
          </p>
        </div>

        <div className="l-gallery-grid" data-l-stagger>
          {GALLERY.map((item) => (
            <figure key={item.title} className="l-gallery-item" data-anime="accent">
              <img src={item.src} alt={item.alt} loading="lazy" decoding="async" />
              <figcaption>
                <strong>{item.title}</strong>
                <span>{item.caption}</span>
                <span>
                  <a href={item.href} target="_blank" rel="noreferrer">
                    {item.credit}
                  </a>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}