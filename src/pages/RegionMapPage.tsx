import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ContextChipBar } from "../components/ContextChipBar";
import { RegionMap } from "../components/RegionMap";
import { Sparkline } from "../components/Sparkline";
import { TopBar } from "../components/TopBar";
import { useInvestigation } from "../lib/context";
import { getVariable } from "../lib/data";
import { formatCoords, formatSlope, slopeAtPoint } from "../lib/trend";
import { useRegionRoute } from "../lib/useRegionRoute";

export function RegionMapPage() {
  const { region } = useRegionRoute();
  const { point, setPoint, setPendingPrompt, live } = useInvestigation();
  const navigate = useNavigate();

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
  const pointAnalysis =
    point &&
    Math.abs(current.target[0] - point[0]) < 1e-9 &&
    Math.abs(current.target[1] - point[1]) < 1e-9
      ? current
      : null;
  const pointSlope = point
    ? pointAnalysis?.isLive
      ? pointAnalysis.stats.slope
      : slopeAtPoint(point[0], point[1], region)
    : null;
  const pointSignificant =
    pointSlope !== null
      ? pointAnalysis?.isLive
        ? pointAnalysis.stats.significant
        : Math.abs(pointSlope) > 0.2
      : false;
  const pointColor =
    pointSlope === null
      ? "var(--accent)"
      : pointSlope > 0
        ? "var(--trend-up)"
        : "var(--trend-down)";

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
              >
                Raw values · soon
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
            The background grid is an illustrative neighborhood layer. Click any
            point to fetch that location&apos;s real NASA POWER trend from the
            backend. Orange = increasing, blue = decreasing.
          </p>
        </aside>

        <section className="map-canvas" aria-label="Spatial trend map">
          <RegionMap
            region={region}
            selectedPoint={point}
            onSelectPoint={(coords) => setPoint(coords)}
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

                <div className="point-actions">
                  <button
                    type="button"
                    className="btn-primary btn-block"
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
