import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Sparkline } from "../components/Sparkline";
import { TopBar } from "../components/TopBar";
import { useInvestigation } from "../lib/context";
import { REGIONS, getVariable } from "../lib/data";
import { computeStats, formatSlope, generateSeries } from "../lib/trend";
import type { Region } from "../lib/types";

export function RegionsPage() {
  const navigate = useNavigate();
  const { setRegion } = useInvestigation();

  const cards = useMemo(
    () =>
      REGIONS.map((region) => {
        const variable = getVariable(region.variable);
        const fullSeries = generateSeries(region);
        const series = fullSeries.filter((_, idx) => idx % 4 === 0);
        const stats = computeStats(region, fullSeries);
        const color =
          region.trendShape === "up" ? "var(--trend-up)" : "var(--trend-down)";
        return { region, variable, stats, series, color };
      }),
    [],
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
            <p className="eyebrow">Atlas Territory Selection · 2000–2024</p>
            <h1 className="regions-title">Three coupled case files.</h1>
            <p className="regions-lede">
              Each folio pairs a terrestrial basin with its neighboring ocean
              margin across a calibrated 25-year satellite record.
            </p>
          </div>

          <div className="region-grid">
            {cards.map(({ region, variable, stats, series, color }) => (
              <button
                key={region.slug}
                type="button"
                className="region-card specimen-frame"
                onClick={() => handleSelect(region)}
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
            Custom bounding-box selection — drawing an arbitrary polygon anywhere
            on Earth will unlock once on-demand backend fetching is connected.
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
