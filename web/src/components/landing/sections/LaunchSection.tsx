import { Link } from "react-router-dom";

export function LaunchSection() {
  return (
    <section id="launch" className="landing-section l-launch l-discovery" data-section="launch" aria-label="Launch Earth Pulse">
      <div className="landing-shell">
        <p className="l-eyebrow" data-l-reveal data-anime="mark">Launch</p>
        <h2 className="l-section-title" data-l-reveal>
          Start Exploring Earth&apos;s Changing Systems.
        </h2>
        <p className="l-section-lede" data-l-reveal>
          Investigate environmental variables, discover regional trends and understand the evidence behind Earth&apos;s
          changing systems.
        </p>
        <div className="l-actions" data-l-reveal>
          <Link to="/regions" className="l-btn-primary">
            Launch Earth Pulse
          </Link>
          <Link to="/regions" className="l-btn-secondary">
            Open application
          </Link>
          <a
            href="https://github.com/cyberhatc/earth-pulse"
            target="_blank"
            rel="noreferrer"
            className="l-btn-secondary"
          >
            GitHub repository
          </a>
        </div>
        <p className="l-credit l-credit-footer" data-l-reveal>
          Imagery credits: NASA Blue Marble / NASA Image and Video Library and other credited NASA Earth observation
          assets (used for contextual illustration). Project: Earth Pulse.
        </p>
      </div>
    </section>
  );
}