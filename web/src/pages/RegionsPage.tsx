import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Sparkline } from "../components/Sparkline";
import { TopBar } from "../components/TopBar";
import { useInvestigation } from "../lib/context";
import { REGIONS, getVariable } from "../lib/data";
import { computeStats, formatSlope, generateSeries } from "../lib/trend";
import { useLivePreviews } from "../lib/useLivePreviews";
import type { Region } from "../lib/types";

export function RegionsPage() {
  const navigate = useNavigate();
  const { setRegion } = useInvestigation();
  const liveBySlug = useLivePreviews(REGIONS);

  const cards = useMemo(
    () =>
      REGIONS.map((region) => {
        const variable = getVariable(region.variable);
        const analysis = liveBySlug[region.slug];
        const fullSeries = analysis?.series ?? generateSeries(region);
        const series = fullSeries.filter((_, idx) => idx % 4 === 0);
        const stats = analysis?.stats ?? computeStats(region, fullSeries);
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
          note: analysis?.sourceLabel,
        };
      }),
    [liveBySlug],
  );

  const handleSelect = (region: Region) => {
    setRegion(region);
    navigate(`/region/${region.slug}`);
  };

  return (
    <div className="page regions-viewport-page">
      <TopBar />
      <main className="regions-page">
        <div className="shell regions-shell">
          <div className="regions-head">
            <p className="eyebrow">Atlas Territory Selection</p>
            <h1 className="regions-title">Three coupled case files.</h1>
            <p className="regions-lede">
              Each folio pairs a terrestrial basin with its neighboring ocean
              margin across a multi-decadal NASA POWER record — with explicit
              demo fallbacks where a satellite product is unavailable.
            </p>
          </div>

          <div className="region-grid">
            {cards.map(({ region, variable, stats, series, color, live, status, note }) => (
              <button
                key={region.slug}
                type="button"
                className="region-card specimen-frame"
                onClick={() => handleSelect(region)}
                title={note}
              >
                <div className="region-card-strip halftone-strip">
                  <span className="region-card-overlay">
                    {region.plate} · {variable.shortName}
                  </span>
                  <span
                    className="region-card-rate"
                    style={{ color }}
                  >
                    {formatSlope(stats)}
                  </span>
                  <Sparkline
                    values={series}
                    width={320}
                    height={68}
                    color={color}
                    className="region-card-sparkline"
                  />
                  <span className={`card-live-badge preview-source-${status}`}>
                    <span className={`live-dot live-${status}`} aria-hidden="true" />
                    {live ? "LIVE" : status === "partial" ? "DEMO VAR" : "DEMO"}
                  </span>
                </div>
                <div className="region-card-body">
                  <div className="region-card-eyebrow">
                    {region.bboxLabel} · {region.subtitle}
                  </div>
                  <h2 className="region-card-name">{region.name}</h2>
                  <p className="region-card-meta">
                    {region.area} · {region.climate}
                  </p>
                  <p className="region-card-teaser">
                    {region.teaser}{" "}
                    <span className="teaser-arrow" aria-hidden="true">
                      →
                    </span>
                  </p>
                </div>
              </button>
            ))}
          </div>

          <div className="divider" role="separator">
            <span>or</span>
          </div>

          <div className="custom-note">
            Custom bounding-box selection is not yet wired in this build. Pick a
            case file above, then pin any point on its regional map to query the
            live backend at that coordinate.
          </div>

          <div className="regions-back">
            <Link to="/" className="back-link">
              ← Return to monograph overview
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
