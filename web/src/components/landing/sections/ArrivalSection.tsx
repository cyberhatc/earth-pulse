import { Link } from "react-router-dom";
import { ScrollIndicator } from "../ScrollIndicator";

export function ArrivalSection() {
  return (
    <section id="arrival" className="landing-section l-arrival" data-section="arrival" aria-label="Arrival">
      <div className="landing-shell l-hero-grid">
        <div className="l-hero-copy">
          <p className="l-eyebrow" data-l-reveal>
            Archival Case Monograph · Vol. I · Earth Observation
          </p>
          <h1 className="l-hero-title" data-l-reveal>
            Every coast keeps a ledger. <br />
            Pick one. <em>Read its trend.</em>
          </h1>
          <p className="l-lede" data-l-reveal>
            Enter a scientific observatory for Earth’s changing systems. Investigate multi-decadal coupled
            land–ocean satellite records across India, East Asia, and the Pacific margin — with statistical
            provenance, anomaly detection, and reproducible case notebooks.
          </p>
          <div className="l-actions" data-l-reveal>
            <Link to="/regions" className="l-btn-primary">
              Open case files →
            </Link>
            <a href="#instruments" className="l-btn-secondary">
              Methodology &amp; instruments
            </a>
          </div>
        </div>
        <div className="l-hero-spacer" aria-hidden="true" />
      </div>
      <ScrollIndicator />
    </section>
  );
}
