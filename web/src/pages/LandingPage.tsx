import { useMemo } from "react";
import { Link } from "react-router-dom";
import heroArtwork from "../assets/images/earth_halftone_hero_1794745404176.jpg";
import { Sparkline } from "../components/Sparkline";
import { TopBar } from "../components/TopBar";
import { REGIONS, getVariable } from "../lib/data";
import { computeStats, formatSlope, generateSeries } from "../lib/trend";
import { useLivePreviews } from "../lib/useLivePreviews";

const STEPS = [
  {
    num: "01",
    title: "Select a territory",
    body: "Three coupled land–ocean folios spanning India, East Asia, and the California margin.",
  },
  {
    num: "02",
    title: "Interrogate the series",
    body: "Pose plain-language questions or inspect gridded decadal slopes directly on the map.",
  },
  {
    num: "03",
    title: "Audit every claim",
    body: "Every card exposes dataset resolution, missing-data rates, and statistical caveats.",
  },
  {
    num: "04",
    title: "Archive & reproduce",
    body: "Freeze parameters, pinned coordinates, and findings into a downloadable Markdown case file.",
  },
];

const CAPABILITIES = [
  {
    code: "Module A · Fingerprint",
    title: "Earth Trend Fingerprint",
    body: "Couples land temperature, canopy NDVI, rainfall, and adjacent sea-surface trends into one significance matrix.",
  },
  {
    code: "Module B · Trust Me",
    title: "Evidence & Confidence Layer",
    body: "Traces every conclusion directly to NASA LP DAAC, GES DISC, spatial resolution, missingness, and limitations.",
  },
  {
    code: "Module C · Anomalies",
    title: "Earth Anomaly Detective",
    body: "Isolates detrended seasonal departures and flags hotspots without conflating weather spikes with climate shifts.",
  },
  {
    code: "Module D · Folio",
    title: "One-Click Investigation Notebook",
    body: "Compiles research question, methods, charts, and confidence limits into a shareable Markdown or JSON dossier.",
  },
  {
    code: "Module E · Global Twins",
    title: "Earth Twin Finder",
    body: "Matches regional trend fingerprints across continents while enforcing explicit dataset comparability rules.",
  },
  {
    code: "Module F · Local Voice",
    title: "Local Earth Stories",
    body: "Translates findings for students, journalists, and researchers in English, हिन्दी, and ಕನ್ನಡ.",
  },
];

export function LandingPage() {
  const liveBySlug = useLivePreviews(REGIONS);
  const previews = useMemo(
    () =>
      REGIONS.map((region) => {
        const analysis = liveBySlug[region.slug];
        const fullSeries = analysis?.series ?? generateSeries(region);
        const series = fullSeries.filter((_, idx) => idx % 4 === 0);
        const stats = analysis?.stats ?? computeStats(region, fullSeries);
        const variable = getVariable(region.variable);
        const color =
          region.trendShape === "up" ? "var(--trend-up)" : "var(--trend-down)";
        return {
          region,
          variable,
          stats,
          series,
          color,
          live: Boolean(analysis?.isLive),
          status: analysis?.status ?? "loading",
        };
      }),
    [liveBySlug],
  );

  return (
    <div className="page">
      <TopBar />
      <main>
        <section className="hero hero-halftone">
          <div className="hero-artwork-wrap" aria-hidden="true">
            <img
              src={heroArtwork}
              alt=""
              className="hero-artwork"
              referrerPolicy="no-referrer"
            />
            <div className="hero-artwork-scrim" />
          </div>

          <div className="shell hero-shell">
            <p className="eyebrow">
              NASA Earth Observation Atlas · Archival Case Monograph · Vol. I
            </p>
            <h1 className="hero-title">
              Every coast keeps a ledger. Pick one. <em>Read its trend.</em>
            </h1>
            <p className="hero-lede">
              Investigate multi-decadal coupled land–ocean satellite records across
              India, East Asia, and the Pacific margin — with full statistical
              provenance, anomaly detection, and reproducible case notebooks.
            </p>

            <div className="hero-actions">
              <Link to="/regions" className="btn-primary">
                Open case files →
              </Link>
              <a href="#how" className="btn-secondary">
                Methodology &amp; suite
              </a>
            </div>

            <div className="preview-card specimen-frame">
              <div className="preview-head">
                <span>ARCHIVE CALIBRATION LEDGER · LIVE BACKEND</span>
                <span>Three coupled land–ocean folios</span>
              </div>
              <div className="preview-grid">
                {previews.map(({ region, variable, stats, series, color, live, status }) => (
                  <Link
                    key={region.slug}
                    to={`/region/${region.slug}`}
                    className="preview-item"
                  >
                    <div className="preview-item-kicker">
                      {region.plate} · {region.bboxLabel}
                    </div>
                    <div className="preview-item-top">
                      <span className="preview-item-name">{region.name}</span>
                      <span className="preview-item-tag">
                        {variable.shortName}
                      </span>
                    </div>
                    <Sparkline
                      values={series}
                      width={210}
                      height={42}
                      color={color}
                    />
                    <div className="preview-item-rate" style={{ color }}>
                      {formatSlope(stats)}
                    </div>
                    <div className={`preview-item-source preview-source-${status}`}>
                      <span className={`live-dot live-${status}`} aria-hidden="true" />
                      {live ? "Live backend" : "Demo series"}
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            <p className="sources-line">
              NASA POWER (1981–present) · NASA GIBS · OpenStreetMap
            </p>
          </div>
        </section>

        <section id="how" className="how-section">
          <div className="shell">
            <p className="eyebrow">01 · Field Protocol</p>
            <h2 className="how-title">Four stages, one traceable dossier.</h2>
            <div className="how-grid">
              {STEPS.map((step) => (
                <article key={step.num} className="how-card">
                  <div className="how-step-num">{step.num}</div>
                  <h3 className="how-step-title">{step.title}</h3>
                  <p className="how-step-body">{step.body}</p>
                </article>
              ))}
            </div>

            <div className="suite-block">
              <p className="eyebrow">02 · Analytical Instruments</p>
              <h2 className="how-title">Six lenses on planetary change.</h2>
              <div className="suite-grid">
                {CAPABILITIES.map((cap) => (
                  <article key={cap.code} className="suite-card">
                    <div className="how-step-num">{cap.code}</div>
                    <h3 className="how-step-title">{cap.title}</h3>
                    <p className="how-step-body">{cap.body}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
