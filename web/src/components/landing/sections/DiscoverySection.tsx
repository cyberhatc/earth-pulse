import { Link } from "react-router-dom";

export function DiscoverySection() {
  return (
    <section id="discovery" className="landing-section l-discovery" data-section="discovery" aria-label="Discovery">
      <div className="landing-shell">
        <p className="l-eyebrow" data-l-reveal data-anime="mark">05 · Discovery</p>
        <h2 className="l-section-title" data-l-reveal>
          The ledger is open. <em>Begin the investigation.</em>
        </h2>
        <p className="l-section-lede" data-l-reveal>
          Move from observation to evidence. Choose a coupled case file and read how land and sea have changed —
          with provenance, uncertainty, and a record you can keep.
        </p>
        <div className="l-actions" data-l-reveal>
          <Link to="/regions" className="l-btn-primary">
            Enter the case files →
          </Link>
          <a href="#instruments" className="l-btn-secondary">
            Review instruments
          </a>
        </div>
      </div>
    </section>
  );
}
