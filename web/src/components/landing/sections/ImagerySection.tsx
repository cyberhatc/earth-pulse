const GALLERY = [
  {
    "src": "/atlas/nile-delta.jpg",
    "alt": "The green fan in northern Egypt follows the branches of the Nile.",
    "title": "Trace the edge of the fields",
    "caption": "The green fan in northern Egypt follows the branches of the Nile. Its sharp edges help you pick places to compare with the surrounding desert.",
    "credit": "Esri World Imagery and contributing providers",
    "href": "https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9"
  },
  {
    "src": "/atlas/himalaya.jpg",
    "alt": "Snow and ice trace the high ridges of the central Himalaya.",
    "title": "Find the high ground",
    "caption": "Snow and ice trace the high ridges of the central Himalaya. Compare images from the same season before interpreting a difference in snow cover.",
    "credit": "Esri World Imagery and contributing providers",
    "href": "https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9"
  },
  {
    "src": "/atlas/amazon.jpg",
    "alt": "Near Manaus, dark and pale river waters meet.",
    "title": "Follow two rivers",
    "caption": "Near Manaus, dark and pale river waters meet. Their visible colors suggest a sampling question; an image alone cannot measure what is in the water.",
    "credit": "Esri World Imagery and contributing providers",
    "href": "https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9"
  }
];

export function ImagerySection() {
  return (
    <section id="imagery" className="landing-section l-imagery" data-section="imagery" aria-label="Satellite imagery gallery">
      <div className="landing-shell">
        <div className="l-section-head" data-l-reveal>
          <p className="l-eyebrow" data-anime="mark">Imagery</p>
          <h2 className="l-section-title">Satellite imagery gallery</h2>
          <p className="l-section-lede">
            Read each landscape from above. These regional mosaics combine images taken at different times. They help you choose what to investigate; a trend needs repeated measurements.
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