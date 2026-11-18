import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ContextChipBar } from "../components/ContextChipBar";
import { TopBar } from "../components/TopBar";
import { TrendChart } from "../components/TrendChart";
import { useInvestigation } from "../lib/context";
import { useRegionRoute } from "../lib/useRegionRoute";
import {
  API_BASE,
  fetchImageryPast,
  fetchImageryTimelapse,
  fetchPoint,
  type BackendPoint,
} from "../lib/api";
import { formatCoords, formatSignedNumber } from "../lib/trend";

type PointParam = {
  key: string;
  label: string;
  unit: string;
  slopeUnit: string;
};

const PARAM_META: PointParam[] = [
  { key: "temperature", label: "Temperature", unit: "°C", slopeUnit: "°C" },
  { key: "temperature_max", label: "Temp max", unit: "°C", slopeUnit: "°C" },
  { key: "temperature_min", label: "Temp min", unit: "°C", slopeUnit: "°C" },
  { key: "precipitation", label: "Precipitation", unit: "mm/month", slopeUnit: "mm/month" },
  { key: "humidity", label: "Humidity", unit: "%", slopeUnit: "%" },
  { key: "wind", label: "Wind", unit: "m/s", slopeUnit: "m/s" },
  { key: "solar_radiation", label: "Solar rad.", unit: "kWh/m²/day", slopeUnit: "kWh/m²/day" },
];

function directionToTrend(d: string | undefined): "up" | "down" | "flat" {
  const v = (d || "").toLowerCase();
  if (v.startsWith("in")) return "up";
  if (v.startsWith("de")) return "down";
  return "flat";
}


export function RegionPointPage() {
  const { region } = useRegionRoute();
  const { point, setPendingPrompt } = useInvestigation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const lat = Number(searchParams.get("lat") ?? point?.[0] ?? region?.center[0] ?? 0);
  const lon = Number(searchParams.get("lon") ?? point?.[1] ?? region?.center[1] ?? 0);

  const [data, setData] = useState<BackendPoint | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [gibs, setGibs] = useState<{ date: string; layer: string; url: string }[]>([]);
  const [timelapse, setTimelapse] = useState<
    { year: number; url: string; label: string }[]
  >([]);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setStatus("loading");
    fetchPoint(lat, lon, 60, controller.signal)
      .then((next) => {
        if (controller.signal.aborted) return;
        setData(next);
        setStatus("ready");
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setStatus("error");
      });
    fetchImageryPast(lat, lon, controller.signal)
      .then((img) => setGibs(img.gibs))
      .catch(() => setGibs([]));
    fetchImageryTimelapse(lat, lon, controller.signal)
      .then((tl) => setTimelapse(tl.frames.filter((f) => f.kind === "observed")))
      .catch(() => setTimelapse([]));
    return () => controller.abort();
  }, [lat, lon]);

  useEffect(() => {
    if (!playing || timelapse.length === 0) return;
    const id = window.setInterval(() => {
      setFrame((f) => (f + 1) % timelapse.length);
    }, 750);
    return () => window.clearInterval(id);
  }, [playing, timelapse.length]);

  const period = useMemo((): [number, number] => {
    const t = data?.past.dates ?? [];
    if (t.length) return [Number(t[0].slice(0, 4)), Number(t[t.length - 1].slice(0, 4))];
    return [1981, 2026];
  }, [data]);

  if (!region) {
    return (
      <div className="workspace-page">
        <TopBar backHref="/regions" backLabel="Regions" />
      </div>
    );
  }

  const trends = data?.trends ?? {};
  const coverage = data?.data_coverage;
  const explanation = data?.explanation;
  const nextMove = data?.next_move ?? {};
  const significant = PARAM_META.filter((p) => trends[p.key]?.significant);
  const rising = PARAM_META.filter((p) => directionToTrend(trends[p.key]?.direction) === "up");
  const falling = PARAM_META.filter((p) => directionToTrend(trends[p.key]?.direction) === "down");
  const gallery = gibs.filter((g) =>
    ["true_color", "ndvi", "sst"].includes(g.layer),
  );

  const handleDiscuss = () => {
    setPendingPrompt(
      `I've pinned ${formatCoords(lat, lon, 2)}. Analyze this exact point in depth: trends, anomalies, and the 5-year forecast.`,
    );
    navigate(`/region/${region.slug}/chat`);
  };

  return (
    <div className="workspace-page">
      <TopBar
        backHref={`/region/${region.slug}/map`}
        backLabel="Back to map"
      />
      <ContextChipBar mode="map" />
      <main className="notebook-page">
        <div className="shell">
          <div className="notebook-head">
            <div>
              <p className="eyebrow">
                EXACT POINT DOSSIER · {region.name} · {formatCoords(lat, lon, 2)}
              </p>
              <h1 className="notebook-title">Point analysis — NASA POWER</h1>
              <p className="notebook-sub">
                {coverage?.time_range?.join(" → ") ?? "…"} · exact-coordinate
                analysis (~50 km NASA POWER) ·{" "}
                {status === "ready" ? "LIVE" : status === "loading" ? "loading…" : "unavailable"}{" "}
                · not a 15° grid cell
              </p>
            </div>
            <div className="notebook-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => navigate(`/region/${region.slug}/map`)}
              >
                ← Back to map
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleDiscuss}
              >
                Discuss this point →
              </button>
            </div>
          </div>

          {status === "error" ? (
            <div className="card">
              <div className="card-body">
                <p className="anomaly-summary">
                  Could not load the exact-point dossier from the backend. Make
                  sure FastAPI is running and network is available — the NASA
                  POWER fetch happens on demand.
                </p>
              </div>
            </div>
          ) : null}

          <section className="card">
            <div className="card-head">
              <span className="card-head-label">7 parameters · slope / decade</span>
              <span className="card-head-meta">
                {significant.length} of {PARAM_META.length} significant
              </span>
            </div>
            <div className="card-body">
              <div className="finding-stats">
                {PARAM_META.map((p) => {
                  const t = trends[p.key];
                  const dir = directionToTrend(t?.direction);
                  const slope = t?.slope_per_decade ?? 0;
                  return (
                    <div className="stat-cell" key={p.key}>
                      <div className="stat-label">{p.label.toUpperCase()}</div>
                      <div
                        className="stat-value"
                        style={{
                          color: dir === "up" ? "var(--trend-up)" : dir === "down" ? "var(--trend-down)" : "var(--ink)",
                        }}
                      >
                        {(slope >= 0 ? "+" : "") + slope.toFixed(3)} {p.slopeUnit}/dec
                      </div>
                      <div className="stat-label" style={{ marginTop: 4 }}>
                        {t?.significant ? "significant · p=" + t.p_value.toFixed(3) : "not sig · p=" + (t?.p_value ?? 1).toFixed(3)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <span className="card-head-label">Charts · 1981–2026, exact coordinate</span>
              <span className="card-head-meta">{data?.past.dates.length ?? "…"} monthly records</span>
            </div>
            <div className="card-body">
              {status === "loading" || !data ? (
                <p className="anomaly-summary">Loading NASA POWER series…</p>
              ) : (
                <div className="notebook-charts">
                  {PARAM_META.map((p) => {
                    const series = (data.past.timeseries[p.key] ?? [])
                      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
                    const t = trends[p.key];
                    const dir = directionToTrend(t?.direction);
                    return (
                      <div key={p.key} className="notebook-chart-cell">
                        <TrendChart
                          series={series}
                          period={period}
                          slopePerDecade={t?.slope_per_decade ?? 0}
                          unit={p.unit}
                          significant={Boolean(t?.significant)}
                          direction={dir}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <span className="card-head-label">Trend analyzer</span>
              <span className="card-head-meta">
                Mann–Kendall · α = 0.05
              </span>
            </div>
            <div className="card-body">
              <p className="anomaly-summary">
                {significant.length > 0
                  ? `${significant.length} of ${PARAM_META.length} parameters are statistically significant: ${significant.map((p) => p.label).join(", ")}. ${rising.length} rising, ${falling.length} falling.`
                  : `No parameter reaches significance at this coordinate with the 0.05 threshold (${rising.length} rising, ${falling.length} falling).`}
              </p>
              {explanation?.text ? (
                <p className="anomaly-summary" style={{ marginTop: 10 }}>{explanation.text}</p>
              ) : null}
              <div className="coverage-columns" style={{ marginTop: 14 }}>
                <div>
                  <div className="coverage-label">RISING (RIDGE DIRECTION)</div>
                  <p>{rising.map((p) => p.label).join(", ") || "none"}</p>
                </div>
                <div>
                  <div className="coverage-label">FALLING</div>
                  <p>{falling.map((p) => p.label).join(", ") || "none"}</p>
                </div>
              </div>
              <div className="coverage-columns" style={{ marginTop: 12 }}>
                {PARAM_META.slice(0, 4).map((p) => {
                  const nm = nextMove[p.key];
                  return (
                    <div key={p.key}>
                      <div className="coverage-label">{p.label.toUpperCase()} — NEXT MOVE</div>
                      <p>
                        {nm?.direction ?? "flat"} ·{" "}
                        {nm ? `${formatSignedNumber(nm.delta_over_horizon ?? 0)} ${p.slopeUnit} over 60 months` : "n/a"}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <span className="card-head-label">Satellite time-lapse · observed</span>
              <span className="card-head-meta">
                MODIS Terra true colour · {timelapse.length} frames · 2000–2025
              </span>
            </div>
            <div className="card-body">
              {timelapse.length ? (
                <div className="timelapse-player">
                  <img
                    src={timelapse[frame]?.url}
                    alt={timelapse[frame]?.label ?? "timelapse frame"}
                    className="timelapse-frame"
                    loading="lazy"
                  />
                  <div className="timelapse-controls">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setPlaying((v) => !v)}
                    >
                      {playing ? "❚❚ Pause" : "▶ Play"}
                    </button>
                    <span className="timelapse-year">{timelapse[frame]?.year ?? ""}</span>
                    <div className="timelapse-dots" aria-label="timelapse frame selector">
                      {timelapse.map((f, i) => (
                        <button
                          key={f.year}
                          type="button"
                          className={`timelapse-dot${i === frame ? " active" : ""}`}
                          aria-label={`Show ${f.year}`}
                          onClick={() => setFrame(i)}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="rail-caption">
                    26 observed MODIS true-colour frames (2000–2025), ~1 km,
                    June–July composite. This is the satellite view of the
                    region over time. Not a video of the future.
                  </p>
                </div>
              ) : (
                <p className="anomaly-summary">
                  Satellite time-lapse unavailable right now.
                </p>
              )}
              <div className="timelapse-gallery">
                {gallery.map((g, i) => (
                  <figure key={`${g.layer}-${g.date}-${i}`} className="timelapse-item">
                    <a href={g.url} target="_blank" rel="noreferrer">
                      <img src={g.url} alt={`${g.layer} ${g.date}`} loading="lazy" />
                      <figcaption>
                        {g.layer} · {g.date}
                      </figcaption>
                    </a>
                  </figure>
                ))}
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <span className="card-head-label">Model projection — not an observation</span>
              <span className="card-head-meta">
                Theil–Sen extrapolation · 2030 / 2035
              </span>
            </div>
            <div className="card-body">
              <div className="notebook-charts">
                {[
                  { parameter: "temperature", year: 2035, label: "Temperature 2035" },
                  { parameter: "precipitation", year: 2035, label: "Precipitation 2035" },
                ].map((m) => (
                  <div key={m.parameter + m.year} className="notebook-chart-cell">
                    <img
                      className="proj-map"
                      src={`${API_BASE}/imagery/projected?parameter=${m.parameter}&year=${m.year}`}
                      alt={`${m.label} (model projection)`}
                      loading="lazy"
                    />
                    <p className="rail-caption" style={{ textAlign: "center" }}>
                      {m.label} · model projection, not an observation
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <p className="rail-caption">
            All statistics computed from NASA POWER monthly data at the exact
            coordinate ({formatCoords(lat, lon, 2)}). POWER is
            satellite+model agroclimatology — not station gauges. NDVI, SST and
            sea level are not available at an exact POWER point and are never
            estimated. Time range {coverage?.time_range?.join("–") ?? "…"}.
          </p>
        </div>
      </main>
    </div>
  );
}
