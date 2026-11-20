export function ObservationSection() {
  return (
    <section id="observe" className="landing-section l-observe" data-section="observe" aria-label="Earth observation context">
      <div className="landing-shell">
        <div className="l-section-head" data-l-reveal>
          <p className="l-eyebrow" data-anime="mark">Observation</p>
          <h2 className="l-section-title">What can a satellite see?</h2>
          <p className="l-section-lede">
            A sensor measures light reflected or emitted by Earth. Each pixel covers a patch of ground or water. Return to that patch over many seasons and a record begins to form.
          </p>
        </div>

        <div className="l-domain-grid" data-l-stagger>
          <article className="l-domain-card" data-anime="accent">
            <h3>Land</h3>
            <p>Surface temperature, vegetation condition, land-cover context.</p>
          </article>
          <article className="l-domain-card" data-anime="accent">
            <h3>Ocean</h3>
            <p>Sea-surface conditions and coastal–marine interfaces.</p>
          </article>
          <article className="l-domain-card" data-anime="accent">
            <h3>Atmosphere</h3>
            <p>Clouds, moisture, winds, precipitation-related signals.</p>
          </article>
          <article className="l-domain-card" data-anime="accent">
            <h3>Vegetation</h3>
            <p>Greenness dynamics and seasonal ecosystem response.</p>
          </article>
        </div>

        <div className="l-explain-grid" data-l-stagger>
          <article className="l-explain-card">
            <h3>Repeated observations</h3>
            <p>
              Consistent revisit cycles enable time-series analysis, helping distinguish short-term variability from
              longer-term trends where data coverage permits.
            </p>
          </article>
          <article className="l-explain-card">
            <h3>Multi-domain context</h3>
            <p>
              Environmental change often spans domains, such as precipitation, vegetation response, and coastal conditions.
            </p>
          </article>
          <article className="l-explain-card">
            <h3>From imagery to evidence</h3>
            <p>
              Visual context and quantitative records are complementary. Imagery aids interpretation, while statistical
              methods and uncertainty estimates support careful conclusions.
            </p>
          </article>
        </div>

        <div className="l-note-panel" data-l-reveal>
          <p className="l-note-kicker">Explore satellite imagery</p>
          <p>Use the date selector in NASA Worldview to revisit a coastline. Look for clouds before comparing the land underneath.</p>
          <a href="https://worldview.earthdata.nasa.gov/">Open NASA Worldview</a>
        </div>
      </div>
    </section>
  );
}