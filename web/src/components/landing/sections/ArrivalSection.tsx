import { Link } from "react-router-dom";
import { ScrollIndicator } from "../ScrollIndicator";

export function ArrivalSection() {
  return (
    <section id="hero" className="landing-section l-arrival" data-section="arrival" aria-label="Arrival">
      <div className="landing-shell l-hero-grid">
        <div className="l-hero-copy">
          <p className="l-eyebrow" data-l-reveal>
            LIVE CONTEXT · 03 REGIONS · MULTI-VARIABLE · SIGNAL → EVIDENCE
          </p>
          <p className="l-eyebrow l-eyebrow-sub" data-l-reveal data-anime="mark">
            OBS MODE · GLOBAL · 23.5°N 78.9°E REF <span className="l-meta-note">(illustrative reference)</span>
          </p>
          <h1 className="l-hero-title" data-l-reveal>
            Discover the Signals.
            <br />
            <em>Understand Earth&apos;s Changing Systems.</em>
          </h1>
          <p className="l-lede" data-l-reveal>
            Explore environmental trends, investigate regional differences and uncover what is changing across our
            planet through Earth observation data. Earth Pulse brings time series, robust statistics, forecasts with
            uncertainty, anomalies, and imagery context into one investigation workflow.
          </p>
          <div className="l-actions" data-l-reveal>
            <Link to="/regions" className="l-btn-primary">
              Explore Earth Pulse
            </Link>
            <a href="#how-it-works" className="l-btn-secondary">
              How It Works
            </a>
          </div>
          <div className="l-value-grid" data-l-stagger aria-label="Key value propositions">
            <article className="l-value-card" data-anime="accent">
              <h2 className="l-value-title">Place-based investigation</h2>
              <p>Inspect past observations, trends, and forecasts for selected locations.</p>
            </article>
            <article className="l-value-card" data-anime="accent">
              <h2 className="l-value-title">Statistical rigor</h2>
              <p>Theil–Sen trends, Mann–Kendall significance, and uncertainty-aware outputs.</p>
            </article>
            <article className="l-value-card" data-anime="accent">
              <h2 className="l-value-title">Transparent coverage</h2>
              <p>Clear labeling for observed data, forecasts, scenarios, and synthetic demo stores.</p>
            </article>
          </div>
        </div>
        <div className="l-hero-spacer" aria-hidden="true" />
      </div>
      <ScrollIndicator />
    </section>
  );
}