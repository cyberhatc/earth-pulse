import { useEffect, useMemo, useRef, useState } from "react";
import { ContextChipBar } from "../components/ContextChipBar";
import { TopBar } from "../components/TopBar";
import { useInvestigation } from "../lib/context";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { useLandingScroll } from "../hooks/useLandingScroll";
import { useAnimeMicro } from "../hooks/useAnimeMicro";
import {
  fetchImageryPast,
  fetchScenario,
  projectedImageUrl,
  timelapseGifUrl,
  type BackendImageryPast,
  type BackendScenario,
} from "../lib/api";
import { useRegionRoute } from "../lib/useRegionRoute";
import { forecastParamFor } from "../lib/live";

const PROJECTED_YEARS = [2025, 2030, 2035, 2040, 2045, 2050];

export function RegionVideosPage() {
  const { region } = useRegionRoute();
  const { point, live } = useInvestigation();
  const target = point ?? region?.center ?? null;
  const rootRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  useLandingScroll({ root: rootRef, reducedMotion, enabled: true });
  useAnimeMicro({ enabled: !reducedMotion, root: rootRef });

  const [past, setPast] = useState<BackendImageryPast | null>(null);
  const [scenario, setScenario] = useState<BackendScenario | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const param = useMemo(() => {
    if (!region) return "temperature";
    return (live.analysis ? forecastParamFor(region, live.analysis) : null) ?? region.variable;
  }, [region, live.analysis]);

  useEffect(() => {
    if (!target || !region) return;
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    Promise.allSettled([
      fetchImageryPast(target[0], target[1], controller.signal),
      fetchScenario(target[0], target[1], region.variable === "ndvi" ? "ndvi" : "temperature", 60, controller.signal),
    ]).then((results) => {
      if (cancelled) return;
      const [pastRes, scenarioRes] = results;
      if (pastRes.status === "fulfilled") setPast(pastRes.value);
      else setPast(null);
      if (scenarioRes.status === "fulfilled") setScenario(scenarioRes.value);
      else setScenario(null);
      if (pastRes.status === "rejected" && scenarioRes.status === "rejected") {
        setError("Imagery endpoints are unavailable right now. You can still review projected model maps below.");
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [target?.[0], target?.[1], region?.slug, region?.variable]);

  if (!region || !target) {
    return (
      <div className="page">
        <TopBar backHref="/regions" backLabel="All case files" />
      </div>
    );
  }

  const gifUrl = timelapseGifUrl(target[0], target[1], param);

  return (
    <div className="workspace-page" ref={rootRef}>
      <TopBar backHref={`/region/${region.slug}`} backLabel={region.name} />
      <ContextChipBar mode="videos" />
      <main className="page-shell detail-page videos-page">
        <section className="section-block" data-l-reveal>
          <p className="eyebrow">Location videos & timelapse · observed past + projected future</p>
          <h1 className="page-title">Videos and imagery timeline for {region.name}</h1>
          <p className="section-lead">
            This view combines observed/reference Earth imagery and model-projected visualization outputs for the selected location.
            Content is labeled by type: <strong>observed/reference</strong>, <strong>model-projected</strong>, and <strong>AI-generated scenario (conditioning/status)</strong>.
            No future frame is presented as an observation.
          </p>
          {loading ? <p className="muted">Loading imagery and video resources…</p> : null}
          {error ? <p className="warn-note">{error}</p> : null}
        </section>

        <section className="section-block" data-l-reveal>
          <div className="section-head-row">
            <h2>Observed past timelapse (backend-generated)</h2>
            <span className="status-pill status-integrated">Observed/model-derived timeline</span>
          </div>
          <p className="muted">
            Animated timelapse assembled by the backend for the selected location and parameter (<code>{param}</code>). Availability depends on
            backend imagery services and data coverage.
          </p>
          <div className="video-card" data-anime="accent">
            <img
              src={gifUrl}
              alt={`Observed timelapse for ${region.name} (${param})`}
              className="timelapse-media"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
                const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                if (fallback) fallback.style.display = "block";
              }}
            />
            <div className="media-fallback" style={{ display: "none" }}>
              <p><strong>Timelapse unavailable.</strong> The backend could not return <code>/imagery/timelapse.gif</code> for this location/parameter.</p>
              <p className="muted">Try checking backend status or use the projected frames and reference imagery below.</p>
            </div>
            <div className="video-meta">
              <div><strong>Type:</strong> Observed past / analysis timeline (as provided by backend)</div>
              <div><strong>Endpoint:</strong> <code>/imagery/timelapse.gif?lat={target[0]}&amp;lon={target[1]}&amp;parameter={param}</code></div>
              <div><strong>Labeling:</strong> Not a forecast; frames represent available historical/derived sequence from the service.</div>
            </div>
          </div>
        </section>

        <section className="section-block" data-l-reveal>
          <div className="section-head-row">
            <h2>Projected future visualization frames</h2>
            <span className="status-pill status-optional">Model-projected · not observations</span>
          </div>
          <p className="muted">
            SVG projections generated from trend/model extrapolation for selected years. These are <strong>model-projected visualizations</strong> with uncertainty and assumptions; they are not satellite observations.
          </p>
          <div className="projected-grid" data-l-stagger>
            {PROJECTED_YEARS.map((year) => (
              <figure key={year} className="projected-card">
                <img
                  src={projectedImageUrl(param, year)}
                  alt={`Model-projected ${param} map for ${year}`}
                  loading="lazy"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).alt = `Projection unavailable for ${year}`;
                  }}
                />
                <figcaption>
                  <strong>{year}</strong> · Model-projected {param}
                  <span className="tag-warn">Projected</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className="section-block" data-l-reveal>
          <div className="section-head-row">
            <h2>Observed/reference imagery</h2>
            <span className="status-pill status-integrated">Observed or reference sources</span>
          </div>
          <p className="muted">{past?.note ?? "Reference imagery from available Earth observation services for orientation and context."}</p>
          {past?.gibs?.length ? (
            <div className="imagery-grid" data-l-stagger>
              {past.gibs.map((img, i) => (
                <figure key={`${img.url}-${i}`} className="imagery-card">
                  <img src={img.url} alt={img.label || img.layer || "GIBS imagery"} loading="lazy" />
                  <figcaption>
                    <strong>{img.label || img.layer}</strong>
                    <span>{img.date} · {img.type === "gibs" ? "GIBS reference imagery" : img.type}</span>
                    <span className="tag-observed">Observed/reference</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <p className="muted">No past imagery references returned for this point. {past?.landsat_query ? "A Landsat query/reference may be available." : ""}</p>
          )}
          {past?.landsat_query ? (
            <div className="info-box">
              <strong>Landsat/reference query:</strong>{" "}
              {typeof past.landsat_query === "string" ? (
                <a href={past.landsat_query} target="_blank" rel="noreferrer">Open query</a>
              ) : past.landsat_query.url ? (
                <a href={past.landsat_query.url} target="_blank" rel="noreferrer">Open Landsat/EarthExplorer query</a>
              ) : (
                <span>{past.landsat_query.note || "Available"}</span>
              )}
            </div>
          ) : null}
        </section>

        <section className="section-block" data-l-reveal>
          <div className="section-head-row">
            <h2>AI-generated scenario video/status</h2>
            <span className="status-pill status-planned">Scenario conditioning · generation status</span>
          </div>
          <p className="muted">
            Full AI scenario video generation may run offline/asynchronously depending on deployment. This panel wires available scenario
            endpoints and clearly reports status, conditioning, and labeling.
          </p>
          {scenario ? (
            <div className="scenario-card" data-anime="accent">
              <div className="scenario-meta-grid">
                <div><strong>Status:</strong> {scenario.enabled ? "Generation enabled/configured" : "Generation not enabled in this environment"}</div>
                <div><strong>Parameter:</strong> {scenario.parameter}</div>
                <div><strong>Label:</strong> {scenario.label || "AI-generated scenario — not an observation"}</div>
                <div><strong>How to generate:</strong> {scenario.how_to_generate || "Use offline scenario generation pipeline when available."}</div>
              </div>
              {scenario.gibs_reference_url ? (
                <figure className="imagery-card">
                  <img src={scenario.gibs_reference_url} alt="Scenario reference imagery" loading="lazy" />
                  <figcaption><strong>Reference frame</strong><span className="tag-observed">Observed/reference input</span></figcaption>
                </figure>
              ) : null}
              <details>
                <summary>Scenario prompt & conditioning (for traceability)</summary>
                <pre className="code-block">{JSON.stringify({ prompt: scenario.prompt, negative_prompt: scenario.negative_prompt, conditioning: scenario.conditioning }, null, 2)}</pre>
              </details>
              <p className="warn-note"><strong>Honesty label:</strong> Any AI-generated scenario output is synthetic/projected media conditioned on data; it must not be interpreted as an observed satellite video.</p>
            </div>
          ) : (
            <div className="info-box">Scenario endpoint unavailable. If the backend exposes <code>/imagery/scenario</code>, status and conditioning will appear here.</div>
          )}
        </section>
      </main>
    </div>
  );
}
