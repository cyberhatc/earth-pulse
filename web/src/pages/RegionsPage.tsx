import { useMemo, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LocationsMap } from "../components/LocationsMap";
import { Reveal } from "../components/Reveal";
import { Sparkline } from "../components/Sparkline";
import { TopBar } from "../components/TopBar";
import { useAmbientMotion } from "../hooks/useAmbientMotion";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { useInvestigation } from "../lib/context";
import { REGIONS, getVariable } from "../lib/data";
import { computeStats, formatSlope, generateSeries } from "../lib/trend";
import { useLivePreviews } from "../lib/useLivePreviews";
import type { Region } from "../lib/types";

export function RegionsPage() {
  const navigate = useNavigate();
  const { setRegion } = useInvestigation();
  const liveBySlug = useLivePreviews(REGIONS);
  const prefersReducedMotion = usePrefersReducedMotion();
  const pageRef = useRef<HTMLElement | null>(null);
  useAmbientMotion({ scopeRef: pageRef, reducedMotion: prefersReducedMotion, enabled: true });

  const cards = useMemo(
    () =>
      REGIONS.map((region) => {
        const variable = getVariable(region.variable);
        const analysis = liveBySlug[region.slug];
        const fullSeries = analysis?.series ?? generateSeries(region);
        const series = fullSeries.filter((_, idx) => idx % 4 === 0);
        const stats = analysis?.stats ?? computeStats(region, fullSeries);
        const color = region.trendShape === "up" ? "var(--trend-up)" : "var(--trend-down)";
        const status = analysis?.status ?? "loading";
        return { region, variable, series, stats, color, status, source: analysis?.sourceLabel ?? "Connecting…" };
      }),
    [liveBySlug],
  );

  const handleOpen = (region: Region) => {
    setRegion(region);
    navigate(`/region/${region.slug}`);
  };

  return (
    <div className="page regions-map-page">
      <TopBar />
      <main ref={pageRef} className="regions-page regions-page-map">
        <div className="shell regions-shell regions-shell-wide">
          <p className="eyebrow" data-l-reveal>Map-first entry · 3 predefined case studies</p>
          <h1 className="regions-title" data-l-parallax>Explore Earth Pulse locations</h1>
          <p className="regions-lede" data-l-reveal>
            Start from the interactive map. Select one of the three case-study regions to inspect its observed history, trends,
            forecasts, anomalies, comparisons, imagery, and location-aware tools. Hover or tap a marker for key info, then click to
            open the full location experience.
          </p>

          <Reveal delay={40}>
            <section className="locations-map-section" aria-label="Interactive locations map">
              <div className="locations-map-frame specimen-frame">
                <LocationsMap regions={REGIONS} analyses={liveBySlug} onSelect={setRegion} />
              </div>
              <div className="locations-map-legend" aria-label="Map legend">
              <span className="legend-pill"><span className="legend-dot" style={{ background: "var(--trend-up)" }} /> Increasing primary signal</span>
              <span className="legend-pill"><span className="legend-dot" style={{ background: "var(--trend-down)" }} /> Decreasing primary signal</span>
              <span className="legend-pill muted">Click a marker or card to inspect location data, chatbot, videos, and visualizations.</span>
            </div>
          </section>
          </Reveal>

          <Reveal delay={100}>
            <div className="divider" aria-hidden="true">Case studies</div>

            <div className="region-grid region-grid-rich" role="list">
              {cards.map(({ region, variable, series, stats, color, status, source }) => (
                <button
                  key={region.slug}
                  type="button"
                  role="listitem"
                  className="region-card specimen-frame region-card-selectable"
                  onClick={() => handleOpen(region)}
                >
                  <div className="region-card-strip halftone-strip">
                    <span className="region-card-overlay">{region.bboxLabel}</span>
                    <span className="region-card-rate" style={{ color }}>{formatSlope(stats)}</span>
                  <Sparkline values={series} width={240} height={66} color={color} className="region-card-sparkline" />
                </div>
                <div className="region-card-body">
                  <div className="region-card-eyebrow">{region.plate} · {variable.shortName}</div>
                  <h2 className="region-card-name">{region.name}</h2>
                  <p className="region-card-meta">{region.climate} · {region.area}</p>
                  <p className="region-card-meta subtle">Trend highlight: {formatSlope(stats)} ({stats.significant ? "significant" : "not significant"}) · {source} ({status})</p>
                  <p className="region-card-teaser">{region.teaser} <span className="teaser-arrow">→</span></p>
                  <div className="region-card-actions">
                    <span className="btn-secondary btn-inline">Open location details</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
          </Reveal>

          <div className="custom-note" role="note">
            <strong>Coverage & honesty:</strong> these are the three predefined demonstration case studies. Live views use the backend
            `/place` payload when available and clearly label observed, projected/forecast, unavailable, and demo/synthetic content.
          </div>

          <p className="regions-back">
            <Link to="/" className="back-link">← About Earth Pulse</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
