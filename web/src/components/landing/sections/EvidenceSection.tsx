export function EvidenceSection() {
  return (
    <section id="evidence" className="landing-section l-evidence" data-section="evidence" aria-label="Evidence">
      <div className="landing-shell">
        <div className="l-section-head" data-l-reveal>
          <p className="l-eyebrow" data-anime="mark">04 · Evidence</p>
          <h2 className="l-section-title">Trends, provenance, and honest limits.</h2>
          <p className="l-section-lede">
            A credible investigation states what is known, how it was measured, and where uncertainty remains.
          </p>
        </div>
        <div className="l-evidence-grid">
          <div className="l-evidence-main" data-l-reveal>
            <h3 className="l-inst-title">From signal to accountable finding</h3>
            <ul className="l-evidence-list">
              <li><strong>Trend investigation.</strong> Multi-decadal series examined for direction and rate, not isolated weather.</li>
              <li><strong>Spatial exploration.</strong> Gridded views place a point within its neighboring pattern and context.</li>
              <li><strong>Evidence &amp; confidence.</strong> Conclusions are tied to datasets, resolution, missingness, and statistical caveats.</li>
              <li><strong>Uncertainty &amp; reproducibility.</strong> Parameters and findings can be reviewed and archived into a case dossier.</li>
            </ul>
          </div>
          <aside className="l-provenance" data-l-reveal>
            <h3 className="l-inst-title">Data status &amp; provenance</h3>
            <p>
              Earth Pulse distinguishes <strong>live backend</strong> series, <strong>demo</strong> series, and
              <strong> synthetic demonstrations</strong> where applicable. The interface presents these states honestly
              and never fabricates observations, endorsements, or capabilities.
            </p>
            <p className="l-sources">
              NASA POWER · MODIS Terra &amp; Aqua · GPM IMERG v07 · JRC Surface Water · OpenStreetMap
            </p>
          </aside>
        </div>
      </div>
    </section>
  );
}
