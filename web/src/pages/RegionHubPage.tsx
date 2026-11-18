import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CardRenderer } from "../components/cards";
import { ContextChipBar } from "../components/ContextChipBar";
import { TopBar } from "../components/TopBar";
import { TrendChart } from "../components/TrendChart";
import { useInvestigation } from "../lib/context";
import { getVariable } from "../lib/data";
import { fetchImageryPast, type BackendImageryPast } from "../lib/api";
import { coverageGaps } from "../lib/live";
import { formatCoords, formatP, formatSlope } from "../lib/trend";
import { useRegionRoute } from "../lib/useRegionRoute";
import type { CanvasCard } from "../lib/types";

function makeCard(kind: CanvasCard["kind"], id: string): CanvasCard {
  return { id, kind, createdAt: Date.now() };
}

export function RegionHubPage() {
  const { region } = useRegionRoute();
  const { point, setPendingPrompt, live } = useInvestigation();
  const navigate = useNavigate();
  const analysis = live.analysis;
  const target = point ?? region?.center ?? null;
  const [imagery, setImagery] = useState<BackendImageryPast | null>(null);

  useEffect(() => {
    if (!target) return;
    let cancelled = false;
    const controller = new AbortController();
    fetchImageryPast(target[0], target[1], controller.signal)
      .then((v) => { if (!cancelled) setImagery(v); })
      .catch(() => { if (!cancelled) setImagery(null); });
    return () => { cancelled = true; controller.abort(); };
  }, [target?.[0], target?.[1]]);

  const summary = useMemo(() => {
    if (!region || !analysis) return null;
    const variable = getVariable(region.variable);
    return { variable, stats: analysis.stats, analysis };
  }, [region, analysis]);

  if (!region || !summary || !analysis || !target) {
    return (
      <div className="page">
        <TopBar backHref="/regions" backLabel="All case files" />
      </div>
    );
  }

  const { variable, stats } = summary;
  const payload = live.payload;
  const coverage = payload?.data_coverage ?? analysis.coverage ?? null;
  const gaps = coverageGaps(coverage);
  const unavailable = coverage?.parameters_unavailable ?? gaps;
  const forecast = analysis.forecast;
  const anomalies = analysis.backendAnomalies?.length ? analysis.backendAnomalies : (payload?.past?.anomalies ?? []);
  const opposites = analysis.opposite?.length ? analysis.opposite : (payload?.opposite_trends ?? []);
  const twin = payload?.climate_twin;
  const primaryAvailable = !(unavailable ?? []).includes(region.variable);

  const jumpToChat = (prompt: string) => {
    setPendingPrompt(prompt);
    navigate(`/region/${region.slug}/chat`);
  };

  const featureLinks = [
    { to: `/region/${region.slug}/visualizations`, title: "Data visualizations", body: "Charts, forecast bands, anomalies, comparisons, and imagery evidence in one view." },
    { to: `/region/${region.slug}/chat`, title: "Location-aware chatbot", body: "Ask questions grounded in this location’s fetched/computed data with source and coverage context." },
    { to: `/region/${region.slug}/videos`, title: "Videos & timelapse", body: "Observed past timelapse and projected future visualization frames, clearly labeled." },
    { to: `/region/${region.slug}/map`, title: "Map inspection", body: "Inspect points within the region, pin coordinates, and explore spatial context." },
    { to: `/region/${region.slug}/notebook`, title: "Notebook / report", body: "Review the investigation record, export/share links, and evidence-backed summaries." },
  ];

  return (
    <div className="page">
      <TopBar backHref="/regions" backLabel="Locations" />
      <ContextChipBar mode="hub" />
      <main className="page-shell detail-page hub-page-rich">
        <section className="hub-hero-block">
          <p className="eyebrow">Location details · selected context persists across all features</p>
          <h1 className="hub-title">{region.name}</h1>
          <p className="hub-sub">
            {region.plate} · {region.climate} · {variable.name} focus · {region.area}
          </p>
          <div className="hub-meta-grid">
            <div className="meta-box"><span className="meta-label">Target / pin</span><strong>{formatCoords(target[0], target[1], 3)}</strong><span className="muted small">{point ? "Pinned point (used by chat, imagery, and analysis where supported)" : "Region center (default)"}</span></div>
            <div className="meta-box"><span className="meta-label">Time range</span><strong>{analysis.period[0]}–{analysis.period[1]}</strong><span className="muted small">{coverage?.time_range ? `Backend coverage: ${coverage.time_range[0]}–${coverage.time_range[1]}` : "Derived from available series"}</span></div>
            <div className="meta-box"><span className="meta-label">Trend ({variable.shortName})</span><strong className={stats.direction === "up" ? "val-up" : stats.direction === "down" ? "val-down" : "val-flat"}>{formatSlope(stats)}</strong><span className="muted small">{formatP(stats.pValue)} · {stats.significant ? "statistically significant" : "not statistically significant"}</span></div>
            <div className="meta-box"><span className="meta-label">Data status</span><strong>{analysis.sourceLabel}</strong><span className="muted small">{analysis.status} · {analysis.isLive ? "live backend payload" : "demo/fallback where needed"}</span></div>
          </div>
          <p className="hub-source-note">{analysis.sourceNote}</p>
        </section>

        <section className="section-block">
          <div className="section-head-row">
            <h2>Access location features</h2>
            <span className="status-pill">Integrated · context preserved</span>
          </div>
          <div className="feature-nav-grid">
            {featureLinks.map((f) => (
              <Link key={f.to} to={f.to} className="feature-nav-card">
                <h3>{f.title}</h3>
                <p>{f.body}</p>
                <span className="feature-nav-cta">Open →</span>
              </Link>
            ))}
          </div>
          <div className="hub-tools quick-prompts">
            <button type="button" className="hub-tool-btn" onClick={() => jumpToChat(`Give me a grounded summary of ${region.name} using observed data, trends, forecast, anomalies, and coverage limitations.`)}>
              <span className="hub-tool-tag">Chat prompt</span>
              <span className="hub-tool-name">Grounded location summary</span>
            </button>
            <button type="button" className="hub-tool-btn" onClick={() => jumpToChat(`What does the forecast say for ${region.name}, including uncertainty and what is observed vs projected?`)}>
              <span className="hub-tool-tag">Chat prompt</span>
              <span className="hub-tool-name">Forecast & uncertainty</span>
            </button>
            <button type="button" className="hub-tool-btn" onClick={() => navigate(`/region/${region.slug}/videos`)}>
              <span className="hub-tool-tag">Media</span>
              <span className="hub-tool-name">Open videos / timelapse</span>
            </button>
          </div>
        </section>


        <section className="section-block">
          <h2>Historical observed data & trend/statistics</h2>
          <p className="muted"><strong>Observed/demo series:</strong> monthly values for {variable.name}. Fitted trend and confidence context shown below; labels indicate significance and source.</p>
          <TrendChart
            series={analysis.series}
            period={analysis.period}
            slopePerDecade={stats.slope}
            unit={variable.unit}
            significant={stats.significant}
            direction={stats.direction}
          />
          <dl className="detail-stats-grid">
            <div><dt>Slope per decade</dt><dd>{formatSlope(stats)} ({stats.slopeUnit})</dd></div>
            <div><dt>Statistical significance</dt><dd>{formatP(stats.pValue)} · {stats.significant ? "significant" : "not significant"} (95% CI: {stats.ciLow.toFixed(3)} to {stats.ciHigh.toFixed(3)})</dd></div>
            <div><dt>Direction</dt><dd>{stats.direction}</dd></div>
            <div><dt>Period analyzed</dt><dd>{analysis.period[0]}–{analysis.period[1]}</dd></div>
          </dl>
        </section>

        <section className="section-block">
          <h2>Forecast / projections, anomalies, and comparisons</h2>
          <p className="muted"><strong>Projected/forecast:</strong> model outputs include uncertainty bands where available and must not be read as observations. Unavailable parameters are listed explicitly.</p>
          <div className="canvas detail-canvas">
            <CardRenderer card={makeCard("forecast", "hub-forecast")} region={region} analysis={analysis} />
            <CardRenderer card={makeCard("anomaly", "hub-anomaly")} region={region} analysis={analysis} />
            <CardRenderer card={makeCard("opposite", "hub-opposite")} region={region} analysis={analysis} />
          </div>
          <div className="insight-grid">
            <div className="info-panel">
              <h3>Climate twin / comparison info</h3>
              {twin ? (
                <ul className="plain-list">
                  <li><strong>Cluster:</strong> {String(twin.cluster_id ?? "n/a")} (k={String(twin.k ?? "n/a")})</li>
                  <li><strong>Features:</strong> {(twin.features ?? []).join(", ") || "Not specified"}</li>
                  <li className="muted small">Climate twin/comparison is derived from backend clustering when available; treat as analytical context, not a guarantee.</li>
                </ul>
              ) : (
                <p className="muted">Climate twin/comparison information is not available for this payload.</p>
              )}
            </div>
            <div className="info-panel">
              <h3>Events & anomaly snapshot</h3>
              {anomalies && anomalies.length ? (
                <ul className="plain-list">
                  {anomalies.slice(0, 6).map((a: any, i: number) => (
                    <li key={i}><strong>{String(a.parameter ?? "param")}</strong>: {String(a.date ?? "")} · z={String(a.z ?? "")} · {String(a.severity ?? "")} {String(a.kind ?? "")}</li>
                  ))}
                </ul>
              ) : (
                <p className="muted">No anomaly events returned for this target/coverage.</p>
              )}
              {opposites && opposites.length ? <p className="muted small">Opposite-trend pairs detected nearby: {opposites.length} (see card for details).</p> : <p className="muted small">No opposite-trend pairs highlighted for this selection.</p>}
            </div>
          </div>
        </section>

        <section className="section-block">
          <h2>Coverage, provenance, and limitations</h2>
          <p className="muted">Clear labeling for observed vs projected and unavailable data. Synthetic/demo fallbacks are identified honestly.</p>
          <div className="canvas detail-canvas">
            <CardRenderer card={makeCard("coverage", "hub-coverage")} region={region} analysis={analysis} />
            <CardRenderer card={makeCard("evidence", "hub-evidence")} region={region} analysis={analysis} />
          </div>
          <div className="coverage-callouts">
            <div className="info-panel">
              <h3>Availability</h3>
              <p><strong>Parameters used:</strong> {(coverage?.parameters_used ?? []).join(", ") || "n/a"}</p>
              <p><strong>Unavailable / limited:</strong> {unavailable.length ? unavailable.join(", ") : "None reported"}</p>
              <p><strong>Primary variable available:</strong> {primaryAvailable ? "yes" : "limited/unavailable in payload"}</p>
            </div>
            <div className="info-panel">
              <h3>Provenance</h3>
              <p><strong>Synthetic/demo:</strong> {coverage?.synthetic_demo ? "yes (clearly labeled demo/synthetic elements may appear)" : "no / live-derived where available"}</p>
              <p><strong>Sources:</strong> {coverage?.sources ? Object.entries(coverage.sources).slice(0, 4).map(([k, v]) => `${k}: ${String(v)}`).join(" · ") : "See evidence card"}</p>
              <p><strong>Notes/gaps:</strong> {(coverage?.gap_notes ?? (coverage as any)?.gaps ?? []).slice(0, 4).join(" · ") || (coverage as any)?.notes || "No additional gap notes"}</p>
            </div>
          </div>
        </section>

        <section className="section-block">
          <h2>Imagery & evidence snapshots</h2>
          <div className="imagery-grid">
            {(imagery?.gibs ?? []).slice(0, 4).map((img, i) => (
              <figure key={`${img.url}-${i}`} className="imagery-card">
                <img src={img.url} alt={img.label || img.layer || "Observed imagery"} loading="lazy" />
                <figcaption><strong>{img.label || img.layer}</strong><span>{img.date}</span><span className="tag-observed">Observed/reference</span></figcaption>
              </figure>
            ))}
            {(forecast?.projected_images ?? []).slice(0, 2).map((img, i) => (
              <figure key={`${img.url}-${i}`} className="imagery-card">
                <img src={img.url} alt={img.label || `Projected ${img.parameter} ${img.date}`} loading="lazy" />
                <figcaption><strong>{img.parameter} · {img.date}</strong><span>{img.label || "Model-projected"}</span><span className="tag-warn">Projected</span></figcaption>
              </figure>
            ))}
          </div>
          {!imagery?.gibs?.length && !forecast?.projected_images?.length ? (
            <p className="muted">Imagery snapshots unavailable for this selection. Open the Videos view for timelapse, projected frames, and scenario status.</p>
          ) : null}
        </section>

        <section className="section-block">
          <h2>Other existing features</h2>
          <ul className="plain-list feature-list">
            <li><Link to={`/region/${region.slug}/map`}>Map inspection</Link>: click within the region, pin coordinates, and inspect location-specific context.</li>
            <li><Link to={`/region/${region.slug}/chat`}>Chatbot</Link>: grounded, location-aware conversation with facts/citations context from the selected payload.</li>
            <li><Link to={`/region/${region.slug}/notebook`}>Notebook/report view</Link>: consolidated investigation record with export/share actions where available.</li>
            <li><Link to={`/region/${region.slug}/visualizations`}>Visualization workspace</Link>: trends, forecast uncertainty, anomalies, comparisons, and evidence cards.</li>
            <li><Link to={`/region/${region.slug}/videos`}>Videos/timelapse</Link>: observed timeline, projected frames, and scenario generation status/wiring.</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
