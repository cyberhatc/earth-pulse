export function PlanetMotionSection() {
  return (
    <section id="planet-motion" className="landing-section l-motion" data-section="motion" aria-label="Planet in Motion">
      <div className="landing-shell l-motion-inner">
        <p className="l-eyebrow" data-l-reveal data-anime="mark">01 · Planet in Motion</p>
        <h2 className="l-section-title" data-l-reveal>
          A living system, measured over decades.
        </h2>
        <p className="l-section-lede" data-l-reveal>
          The planet does not change in headlines. It changes in records — in temperature curves, rainfall
          shifts, canopy stress, and the slow response of neighboring seas. Rotate the evidence. Read the signal.
        </p>
        <div className="l-kinetic-lines" data-l-stagger aria-hidden="true">
          <span data-anime="accent">Land temperature · long-run drift</span>
          <span data-anime="accent">Precipitation · seasonal departure</span>
          <span data-anime="accent">Vegetation &amp; coast · coupled response</span>
          <span data-anime="accent">Significance · uncertainty · provenance</span>
        </div>
      </div>
    </section>
  );
}
