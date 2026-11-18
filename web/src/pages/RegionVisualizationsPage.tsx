import { useEffect, useMemo, useState } from "react";
import { CardRenderer } from "../components/cards";
import { ContextChipBar } from "../components/ContextChipBar";
import { TopBar } from "../components/TopBar";
import { TrendChart } from "../components/TrendChart";
import { useInvestigation } from "../lib/context";
import { getVariable } from "../lib/data";
import { fetchImageryPast, type BackendImageryPast } from "../lib/api";
import { useRegionRoute } from "../lib/useRegionRoute";
import type { CanvasCard } from "../lib/types";

function card(kind: CanvasCard["kind"], id: string): CanvasCard {
  return { id, kind, createdAt: Date.now() };
}

export function RegionVisualizationsPage() {
  const { region } = useRegionRoute();
  const { point, live } = useInvestigation();
  const target = point ?? region?.center ?? null;
  const analysis = live.analysis;
  const [past, setPast] = useState<BackendImageryPast | null>(null);

  useEffect(() => {
    if (!target) return;
    let cancelled = false;
    const controller = new AbortController();
    fetchImageryPast(target[0], target[1], controller.signal)
      .then((v) => { if (!cancelled) setPast(v); })
      .catch(() => { if (!cancelled) setPast(null); });
    return () => { cancelled = true; controller.abort(); };
  }, [target?.[0], target?.[1]]);

  const cards = useMemo(() => {
    if (!region || !analysis) return [] as CanvasCard[];
    return [
      card("finding", "viz-finding"),
      card("trend-chart", "viz-trend"),
      card("forecast", "viz-forecast"),
      card("anomaly", "viz-anomaly"),
      card("opposite", "viz-opposite"),
      card("fingerprint", "viz-fingerprint"),
      card("coverage", "viz-coverage"),
      card("evidence", "viz-evidence"),
      card("variable", "viz-variable"),
    ];
  }, [region?.slug, analysis]);

  if (!region || !analysis || !target) {
    return (
      <div className="page">
        <TopBar backHref="/regions" backLabel="All case files" />
      </div>
    );
  }

  const variable = getVariable(region.variable);

  return (
    <div className="workspace-page">
      <TopBar backHref={`/region/${region.slug}`} backLabel={region.name} />
      <ContextChipBar mode="visualizations" />
      <main className="page-shell detail-page visualizations-page">
        <section className="section-block">
          <p className="eyebrow">Data visualizations · observed, projected, and derived insights</p>
          <h1 className="page-title">Visual analysis for {region.name}</h1>
          <p className="section-lead">
            Clear, labeled visualizations for historical observed series, trends, forecast uncertainty bands, anomalies, comparisons, and
            supporting evidence. Missing or unavailable parameters are shown explicitly; observed and projected content are labeled.
          </p>
          <div className="viz-status-row">
            <span className={`status-pill ${analysis.isLive ? "status-integrated" : "status-optional"}`}>{analysis.sourceLabel}</span>
            <span className="status-pill">Target: {target[0].toFixed(3)}, {target[1].toFixed(3)}</span>
            <span className="status-pill">Variable focus: {variable.name}</span>
          </div>
          <p className="muted small">{analysis.sourceNote}</p>
        </section>

        <section className="section-block">
          <h2>Historical observed series & trend</h2>
          <p className="muted">Observed/demo historical monthly series for the selected variable with fitted trend and significance context.</p>
          <div className="viz-chart-wrap">
            <TrendChart
              series={analysis.series}
              period={analysis.period}
              slopePerDecade={analysis.stats.slope}
              unit={variable.unit}
              significant={analysis.stats.significant}
              direction={analysis.stats.direction}
            />
          </div>
        </section>

        <section className="section-block">
          <h2>Integrated cards & comparisons</h2>
          <p className="muted">Forecasts include uncertainty bands where available; anomalies and opposite trends are derived from backend analysis; coverage/provenance states limitations clearly.</p>
          <div className="canvas viz-canvas">
            {cards.map((c) => (
              <CardRenderer key={c.id} card={c} region={region} analysis={analysis} />
            ))}
          </div>
        </section>

        <section className="section-block">
          <h2>Imagery & observational evidence</h2>
          <p className="muted">Reference/observed imagery for context. Imagery availability varies by source and location.</p>
          {past?.gibs?.length ? (
            <div className="imagery-grid">
              {past.gibs.slice(0, 6).map((img, i) => (
                <figure key={`${img.url}-${i}`} className="imagery-card">
                  <img src={img.url} alt={img.label || img.layer || "Imagery"} loading="lazy" />
                  <figcaption>
                    <strong>{img.label || img.layer}</strong>
                    <span>{img.date}</span>
                    <span className="tag-observed">Observed/reference</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <div className="info-box">No reference imagery returned for this target point. Use the Videos view for projected frames and scenario status.</div>
          )}
        </section>
      </main>
    </div>
  );
}
