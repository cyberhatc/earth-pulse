import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ContextChipBar } from "../components/ContextChipBar";
import { RegionMap } from "../components/RegionMap";
import { Sparkline } from "../components/Sparkline";
import { TopBar } from "../components/TopBar";
import { useInvestigation } from "../lib/context";
import { getVariable } from "../lib/data";
import { fetchPoint, type BackendPoint } from "../lib/api";
import { formatCoords, formatSlope } from "../lib/trend";
import { useRegionRoute } from "../lib/useRegionRoute";

export function RegionMapPage() {
  const { region } = useRegionRoute();
  const { point, setPoint, setPendingPrompt, live } = useInvestigation();
  const navigate = useNavigate();

  const [pointAnalysis, setPointAnalysis] = useState<BackendPoint | null>(null);
  const [pointStatus, setPointStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  // Exact NASA POWER analysis for the pinned coordinate (nearest 15° cell is a
  // different thing — this fetches the point itself, cached after first build).
  useEffect(() => {
    if (!point) {
      setPointAnalysis(null);
      setPointStatus("idle");
      return;
    }
    const controller = new AbortController();
    setPointAnalysis(null);
    setPointStatus("loading");
    fetchPoint(point[0], point[1], 60, controller.signal)
      .then((next) => {
        setPointAnalysis(next);
        setPointStatus("ready");
      })
      .catch((err: Error) => {
        if (controller.signal.aborted) return;
        setPointStatus("error");
        console.warn("fetchPoint failed:", err);
      });
    return () => controller.abort();
  }, [point]);

  const analysis = useMemo(() => {
    if (!region || !live.analysis) return null;
    const variable = getVariable(region.variable);
    const current = live.analysis;
    const sampledSeries = current.series.filter((_, idx) => idx % 6 === 0);
    return { variable, stats: current.stats, sampledSeries, current };
  }, [region, live.analysis]);

  if (!region || !analysis) {
    return (
      <div className="workspace-page">
        <TopBar backHref="/regions" backLabel="Regions" />
      </div>
    );
  }

  const { variable, stats, sampledSeries, current } = analysis;
  const pointSlope = point ? current.stats.slope : null;
  const pointSignificant = point ? current.stats.significant : false;
  const pointColor =
    pointSlope === null
      ? "var(--accent)"
      : current.isLive
        ? pointSlope > 0
          ? "var(--trend-up)"
          : "var(--trend-down)"
        : "var(--trend-flat)";

  const openNotebook = (coords: [number, number]) => {
    navigate(
      `/region/${region.slug}/notebook?pt=${coords[0].toFixed(4)},${coords[1].toFixed(4)}`,
    );
  };

  const handleDiscuss = () => {
    if (!point) return;
    setPendingPrompt(
      `I've selected ${formatCoords(point[0], point[1], 1)}. What's happening here?`,
    );
    navigate(`/region/${region.slug}/chat`);
  };

  return (
    <div className="workspace-page">
      <TopBar backHref={`/region/${region.slug}`} backLabel={region.name} />
      <ContextChipBar mode="map" />
      <main className="map-layout">
        <aside className="map-rail" aria-label="Map controls">
          <div className="rail-section">
            <div className="rail-label">VARIABLE</div>
            <div className="rail-option rail-option-active">
              {variable.name}
            </div>
          </div>

          <div className="rail-section">
            <div className="rail-label">LAYER</div>
            <div className="rail-options">
              <div className="rail-option rail-option-active">
                Trend (slope)
              </div>
              <button
                type="button"
                className="rail-option rail-option-disabled"
                disabled
                aria-disabled="true"
                title="Raw value layer is not yet available"
              >
                Raw values (not yet available)
              </button>
            </div>
          </div>

          <div className="rail-section">
            <div className="rail-label">REGION TREND</div>
            <div className="rail-chip">{formatSlope(stats)}</div>
            <div className={`rail-status rail-status-${current.status}`}>
              <span className={`live-dot live-${current.status}`} aria-hidden="true" />
              {current.isLive ? "LIVE BACKEND" : current.status === "partial" ? "DEMO VARIABLE" : "CONNECTING"}
            </div>
          </div>

          <p className="rail-caption">
            <strong>Legend (illustrative layer):</strong> grid colors show a relative
            neighborhood slope tendency for {variable.name} (not a direct measured
            per-point series). <strong>Fetched point:</strong> click/tap any point to
            retrieve that location’s computed trend from the backend, reported in{" "}
            {variable.perDecadeUnit}. Warm/orange = increasing tendency, cool/blue =
            decreasing tendency, neutral = near zero. “Raw values” are not yet
            available as a map layer.
          </p>
        </aside>

        <section className="map-canvas" aria-label="Spatial trend map">
          <RegionMap
            region={region}
            selectedPoint={point}
            onSelectPoint={(coords) => {
              setPoint(coords);
              openNotebook(coords);
            }}
          />
        </section>

        <aside className="point-panel" aria-label="Selected point details">
          {!point || pointSlope === null ? (
            <div className="point-empty">
              Click anywhere on the map to investigate that point.
            </div>
          ) : (
            <>
              <div className="point-head">
                <div>
                  <div className="point-coord">
                    {formatCoords(point[0], point[1], 2)}
                  </div>
                  <div className="point-context">
                    {region.name} · {region.climate}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setPoint(null)}
                  aria-label="Clear selected point"
                >
                  ×
                </button>
              </div>

              <div className="point-body">
                <div className="point-variable">
                  {variable.name.toUpperCase()}
                  <span className={`point-live point-live-${current.status}`}>
                    <span className={`live-dot live-${current.status}`} aria-hidden="true" />
                    {current.isLive ? "LIVE" : current.status === "partial" ? "DEMO" : "…"}
                  </span>
                </div>
                <div
                  className="point-value"
                  style={{ color: pointColor }}
                >
                  {formatSlope({
                    slope: pointSlope,
                    slopeUnit: variable.perDecadeUnit,
                  })}
                </div>
                <div className="point-pill-wrap">
                  <span
                    className={`stamp ${pointSignificant ? "stamp-sig" : "stamp-not-sig"}`}
                  >
                    {pointSignificant ? "Significant trend" : "Not significant"}
                  </span>
                </div>

                <div className="point-series">
                  <div className="point-series-label">LOCAL SERIES</div>
                  <Sparkline
                    values={sampledSeries}
                    width={260}
                    height={50}
                    color={pointColor}
                  />
                </div>

                <div className="point-exact">
                  <div className="point-exact-label">
                    EXACT-POINT ANALYSIS · NASA POWER
                    {pointStatus === "loading" ? " (BUILDING CACHE…)" : null}
                  </div>
                  {pointStatus === "error" ? (
                    <p className="rail-caption">
                      Point endpoint unreachable — showing the nearest 15° grid
                      cell instead. Retry by re-selecting the pin.
                    </p>
                  ) : pointStatus === "loading" ? (
                    <p className="rail-caption">
                      Fetching NASA POWER at the exact coordinate…
                    </p>
                  ) : pointAnalysis ? (
                    <>
                      <dl className="point-exact-grid">
                        {pointAnalysis.data_coverage.parameters_used.map(
                          (param) => {
                            const t = pointAnalysis.trends[param];
                            if (!t) return null;
                            const unit: Record<string, string> = {
                              temperature: "°C",
                              temperature_max: "°C",
                              temperature_min: "°C",
                              dew_point: "°C",
                              skin_temperature: "°C",
                              diurnal_temperature_range: "°C",
                              precipitation: "mm/mo",
                              solar_radiation: "kWh/m²/d",
                              clear_sky_solar_radiation: "kWh/m²/d",
                              humidity: "%",
                              specific_humidity: "g/kg",
                              wind: "m/s",
                              surface_pressure: "kPa",
                              soil_moisture_surface: "",
                            };
                            const u = unit[param] ?? "units";
                            return (
                              <div key={param}>
                                <dt>{param.replace(/_/g, " ").toUpperCase()}</dt>
                                <dd>
                                  {(t.slope_per_decade >= 0 ? "+" : "") +
                                    t.slope_per_decade.toFixed(3)}{" "}
                                  {u}/dec
                                  {t.significant ? " ▲" : ""}
                                </dd>
                              </div>
                            );
                          },
                        )}
                      </dl>
                      <p className="rail-caption">
                        {pointAnalysis.data_coverage.time_range[0]}→
                        {pointAnalysis.data_coverage.time_range[1]} · real NASA
                        POWER at this coordinate (resolution ~50 km) ·
                        NDVI/SST not available · ▲ = Mann–Kendall significant.
                      </p>
                    </>
                  ) : null}
                </div>

                <div className="point-actions">
                  <button
                    type="button"
                    className="btn-primary btn-block"
                    onClick={() =>
                      navigate(
                        `/region/${region.slug}/point?lat=${point[0]}&lon=${point[1]}`,
                      )
                    }
                  >
                    Open point dossier →
                  </button>
                  <button
                    type="button"
                    className="btn-secondary btn-block"
                    onClick={handleDiscuss}
                  >
                    Discuss this point →
                  </button>
                </div>
              </div>
            </>
          )}
        </aside>
      </main>
    </div>
  );
}
