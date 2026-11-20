import { Link } from "react-router-dom";
import { ScrollIndicator } from "../ScrollIndicator";

export function ArrivalSection({ children }: { children: React.ReactNode }) {
  return (
    <section id="hero" className="landing-section l-arrival" data-section="arrival" aria-label="Arrival">
      {children}
      <div className="landing-shell l-hero-grid">
        <div className="l-hero-copy">
          <p className="l-eyebrow" data-l-reveal>
            Earth observation explorer
          </p>
          <h1 className="l-hero-title" data-l-reveal>
            How is Earth changing<br /><em>where you live?</em>
          </h1>
          <p className="l-lede" data-l-reveal>
            Pick a place and follow its rainfall, heat or vegetation through the years. Compare it with a neighbor to see whether they share the same pattern.
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
              <h2 className="l-value-title">Check the evidence</h2>
              <p>Theil–Sen trends, Mann–Kendall significance, and uncertainty-aware outputs.</p>
            </article>
            <article className="l-value-card" data-anime="accent">
              <h2 className="l-value-title">Transparent coverage</h2>
              <p>The offline demo uses simulated data. Check the source label in each investigation.</p>
            </article>
          </div>
        </div>
        <div className="l-hero-spacer" aria-hidden="true" />
      </div>
      <ScrollIndicator />
    </section>
  );
}