export function TransparencySection() {
  return (
    <section id="transparency" className="landing-section l-transparency" data-section="transparency" aria-label="Data transparency">
      <div className="landing-shell">
        <div className="l-section-head" data-l-reveal>
          <p className="l-eyebrow" data-anime="mark">Transparency</p>
          <h2 className="l-section-title">Data transparency</h2>
          <p className="l-section-lede">
            Clear distinctions, limitations, and uncertainty. Interpret outputs together with coverage metadata, method
            assumptions, and source limitations.
          </p>
        </div>

        <div className="l-transparency-grid" data-l-stagger>
          <article className="l-notice l-notice-warn">
            <h3>Important: bundled synthetic demo data</h3>
            <p>
              The default offline/bundled sample store used for quickstart demos is <strong>deterministic synthetic
              data</strong> generated for reproducible application behavior. It is <strong>not real NASA observation
              data</strong> and must not be presented as measured historical reality.
            </p>
          </article>

          <article className="l-notice">
            <h3>Observed data vs derived outputs</h3>
            <ul>
              <li><strong>Real observations:</strong> present only when the active workflow/store is built from actual source products and reported as such.</li>
              <li><strong>Forecasts:</strong> model-derived estimates with uncertainty bands (p10/p50/p90), not certainties.</li>
              <li><strong>AI-generated or scenario imagery (if shown):</strong> illustrative outputs labeled separately from observations.</li>
            </ul>
          </article>

          <article className="l-notice">
            <h3>Coverage, resolution, and gaps</h3>
            <ul>
              <li>Parameters may be unavailable, masked, or irrelevant depending on geography.</li>
              <li>Historical length and resolution vary by source and product.</li>
              <li>No single source provides uniform 1 km, 40-year continuity for every variable.</li>
              <li>Coverage/provenance information should be shown wherever the application supports it.</li>
            </ul>
          </article>

          <article className="l-notice">
            <h3>Statistical uncertainty and limitations</h3>
            <ul>
              <li>Statistical significance depends on data quality, length, and variability.</li>
              <li>Anomalies are not proof of causation.</li>
              <li>Forecast performance is context-dependent.</li>
              <li>Results should not be over-interpreted beyond supported evidence.</li>
            </ul>
          </article>
        </div>
      </div>
    </section>
  );
}