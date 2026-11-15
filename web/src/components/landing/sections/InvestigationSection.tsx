import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Sparkline } from "../../Sparkline";
import { REGIONS, getVariable } from "../../../lib/data";
import { computeStats, formatSlope, generateSeries } from "../../../lib/trend";
import { useLivePreviews } from "../../../lib/useLivePreviews";

export function InvestigationSection() {
  const liveBySlug = useLivePreviews(REGIONS);
  const previews = useMemo(
    () =>
      REGIONS.map((region) => {
        const analysis = liveBySlug[region.slug];
        const fullSeries = analysis?.series ?? generateSeries(region);
        const series = fullSeries.filter((_, idx) => idx % 4 === 0);
        const stats = analysis?.stats ?? computeStats(region, fullSeries);
        const variable = getVariable(region.variable);
        const color = region.trendShape === "up" ? "#f2f0ea" : "#9ca3af";
        return { region, variable, stats, series, color, live: Boolean(analysis?.isLive), status: analysis?.status ?? "loading" };
      }),
    [liveBySlug],
  );

  return (
    <section id="investigation" className="landing-section l-investigation" data-section="investigation" aria-label="Investigation">
      <div className="landing-shell">
        <div className="l-section-head" data-l-reveal>
          <p className="l-eyebrow" data-anime="mark">02 · Investigation</p>
          <h2 className="l-section-title">Three coupled land–ocean case files.</h2>
          <p className="l-section-lede">
            Each folio pairs a territory with its adjacent sea — framed as an investigation, not a dashboard.
            Open a file to interrogate the series, map spatial change, and audit every claim.
          </p>
        </div>

        <div className="l-cards-3" data-l-stagger>
          {previews.map(({ region, variable, stats }) => (
            <Link key={region.slug} to={`/region/${region.slug}`} className="l-case-card l-card-link" data-anime="accent">
              <div className="l-card-meta">{region.plate} · {region.bboxLabel}</div>
              <h3 className="l-card-title">{region.name}</h3>
              <p className="l-card-body">{region.teaser}</p>
              <div className="l-card-stat">
                {formatSlope(stats)} <small>· {variable.shortName}</small>
              </div>
            </Link>
          ))}
        </div>

        <div className="l-preview-strip" data-l-reveal>
          <div className="l-preview-head">
            <span>Archive calibration ledger · live / demo series</span>
            <span>Three coupled land–ocean folios</span>
          </div>
          <div className="l-preview-grid">
            {previews.map(({ region, variable, stats, series, color, live, status }) => (
              <Link key={region.slug} to={`/region/${region.slug}`} className="l-preview-item l-mini-link">
                <div className="l-card-meta">{region.plate} · {region.bboxLabel}</div>
                <div className="l-preview-name">{region.name}</div>
                <Sparkline values={series} width={210} height={40} color={color} />
                <div className="l-preview-rate" style={{ color }}>{formatSlope(stats)}</div>
                <div className="l-preview-src">
                  <span className={`l-dot ${status === "live" || live ? "live" : status === "loading" ? "loading" : "demo"}`} aria-hidden="true" />
                  {live ? "Live backend" : status === "loading" ? "Checking series" : "Demo series"}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
