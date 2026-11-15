export function ObservationSection() {
  return (
    <section id="observe" className="landing-section l-observe" data-section="observe" aria-label="Earth observation context">
      <div className="landing-shell">
        <div className="l-section-head" data-l-reveal>
          <p className="l-eyebrow" data-anime="mark">Observation</p>
          <h2 className="l-section-title">Investigate change with context.</h2>
          <p className="l-section-lede">
            Earth Pulse connects environmental signals across time and space, supporting comparison, interpretation,
            and careful communication of uncertainty.
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
          <p className="l-note-kicker">Explanatory visual context (non-live)</p>
          <p>
            Earth observation imagery is presented as contextual, explanatory material only — <strong>not live satellite
            telemetry</strong> and not a direct output of this application unless explicitly labeled in the app.
          </p>
          <p className="l-credit">
            Credit: NASA Blue Marble / NASA Image and Video Library.{" "}
            <a href="https://images.nasa.gov/details/PIA18033" target="_blank" rel="noreferrer">
              NASA Blue Marble (PIA18033)
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}