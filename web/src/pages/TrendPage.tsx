import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { TopBar } from "../components/TopBar";
import { fetchGridTrends, type BackendGridTrends } from "../lib/api";

const VARIABLES = [
  "temperature",
  "precipitation",
  "humidity",
  "wind",
  "solar_radiation",
];

function colorFor(slope: number, significant: boolean): string {
  if (!significant) return "rgba(120,120,120,0.25)";
  if (slope > 0) return `rgba(220, 80, 40, ${Math.min(0.9, 0.25 + Math.abs(slope) * 2)})`;
  if (slope < 0) return `rgba(40, 90, 200, ${Math.min(0.9, 0.25 + Math.abs(slope) * 2)})`;
  return "rgba(120,120,120,0.25)";
}

export function TrendPage() {
  const [variable, setVariable] = useState("temperature");
  const [data, setData] = useState<BackendGridTrends | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    setError(null);
    fetchGridTrends(variable, controller.signal)
      .then((next) => {
        if (controller.signal.aborted) return;
        setData(next);
        setStatus("ready");
      })
      .catch((err: Error) => {
        if (controller.signal.aborted) return;
        setStatus("error");
        setError(err.message);
      });
    return () => controller.abort();
  }, [variable]);

  const summary = useMemo(() => {
    if (!data) return null;
    const slopes = data.cells.map((c) => c.slope_per_decade);
    const sig = data.cells.filter((c) => c.significant);
    const mean = slopes.reduce((a, b) => a + b, 0) / (slopes.length || 1);
    const rising = data.cells.filter((c) => c.direction === "increasing").length;
    const falling = data.cells.filter((c) => c.direction === "decreasing").length;
    const topRising = [...data.cells].sort((a, b) => b.slope_per_decade - a.slope_per_decade).slice(0, 5);
    const topFalling = [...data.cells].sort((a, b) => a.slope_per_decade - b.slope_per_decade).slice(0, 5);
    return { mean, sigCount: sig.length, rising, falling, topRising, topFalling, total: data.cells.length };
  }, [data]);

  // group cells into lat rows
  const rows = useMemo(() => {
    if (!data) return [];
    const byLat = new Map<number, typeof data.cells>();
    for (const c of data.cells) {
      if (!byLat.has(c.lat)) byLat.set(c.lat, []);
      byLat.get(c.lat)!.push(c);
    }
    return [...byLat.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([lat, cells]) => ({ lat, cells: cells.sort((a, b) => a.lon - b.lon) }));
  }, [data]);

  return (
    <div className="workspace-page">
      <TopBar backHref="/regions" backLabel="Regions" />
      <main className="trend-page">
        <div className="shell">
          <header className="trend-head">
            <p className="eyebrow">EARTH TREND DETECTOR · GLOBAL GRID</p>
            <h1 className="trend-title">How the Earth is changing</h1>
            <p className="trend-sub">
              Per-cell robust trends (Theil–Sen slope + Mann–Kendall significance) computed by the backend
              from the observed record. Red = increasing, blue = decreasing, grey = not significant.
              {data ? ` · ${data.time_range?.[0]} → ${data.time_range?.[1]}` : ""}
            </p>
          </header>

          <div className="trend-controls">
            <label>
              Variable{" "}
              <select value={variable} onChange={(e) => setVariable(e.target.value)}>
                {VARIABLES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <span className="trend-status">
              {status === "loading" && "Loading…"}
              {status === "error" && `Error: ${error}`}
              {status === "ready" && data && `${data.n_cells} cells · ${data.synthetic_demo ? "synthetic demo" : "real NASA POWER"}`}
            </span>
          </div>

          {summary && (
            <div className="kpi-strip" role="group" aria-label="Headline numbers">
              <div className="kpi-tile">
                <span className="kpi-label">Mean slope</span>
                <span className="kpi-value">{summary.mean.toFixed(4)}</span>
                <span className="kpi-note">per decade · {variable}</span>
              </div>
              <div className="kpi-tile">
                <span className="kpi-label">Significant cells</span>
                <span className="kpi-value">{summary.sigCount}</span>
                <span className="kpi-note">of {summary.total} (Mann–Kendall α=0.05)</span>
              </div>
              <div className="kpi-tile">
                <span className="kpi-label">Rising</span>
                <span className="kpi-value">{summary.rising}</span>
                <span className="kpi-note">cells trending up</span>
              </div>
              <div className="kpi-tile">
                <span className="kpi-label">Falling</span>
                <span className="kpi-value">{summary.falling}</span>
                <span className="kpi-note">cells trending down</span>
              </div>
            </div>
          )}

          <section className="card report-card" aria-labelledby="trend-grid">
            <div className="card-head">
              <span className="card-head-label" id="trend-grid">Global trend grid · {variable}</span>
              <span className="card-head-meta">{rows.length} lat bands</span>
            </div>
            <div className="card-body">
              <div className="trend-grid" role="grid" aria-label="Global trend grid">
                {rows.map((row) => (
                  <div key={row.lat} className="trend-grid-row">
                    <span className="trend-grid-lat">{row.lat}°</span>
                    {row.cells.map((c) => (
                      <span
                        key={`${c.lat}-${c.lon}`}
                        className="trend-grid-cell"
                        style={{ background: colorFor(c.slope_per_decade, c.significant) }}
                        title={`${c.lat}°, ${c.lon}°: ${c.slope_per_decade.toFixed(4)}/dec (p=${c.p_value.toFixed(3)})`}
                      />
                    ))}
                  </div>
                ))}
              </div>
              <div className="trend-legend">
                <span><i style={{ background: "rgba(40,90,200,0.7)" }} /> decreasing</span>
                <span><i style={{ background: "rgba(120,120,120,0.25)" }} /> not significant</span>
                <span><i style={{ background: "rgba(220,80,40,0.7)" }} /> increasing</span>
              </div>
            </div>
          </section>

          {summary && (
            <div className="report-two-col">
              <section className="card report-card" aria-labelledby="trend-rising">
                <div className="card-head">
                  <span className="card-head-label" id="trend-rising">Top rising cells</span>
                </div>
                <div className="card-body">
                  <ul className="trend-list">
                    {summary.topRising.map((c) => (
                      <li key={`r-${c.lat}-${c.lon}`}>
                        {c.lat}°, {c.lon}° · {c.slope_per_decade >= 0 ? "+" : ""}
                        {c.slope_per_decade.toFixed(4)}/dec · p={c.p_value.toFixed(3)}
                        {c.significant ? " ▲" : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
              <section className="card report-card" aria-labelledby="trend-falling">
                <div className="card-head">
                  <span className="card-head-label" id="trend-falling">Top falling cells</span>
                </div>
                <div className="card-body">
                  <ul className="trend-list">
                    {summary.topFalling.map((c) => (
                      <li key={`f-${c.lat}-${c.lon}`}>
                        {c.lat}°, {c.lon}° · {c.slope_per_decade >= 0 ? "+" : ""}
                        {c.slope_per_decade.toFixed(4)}/dec · p={c.p_value.toFixed(3)}
                        {c.significant ? " ▲" : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            </div>
          )}

          <p className="report-coda">
            Want a per-location investigation?{" "}
            <Link to="/regions">Open a case-study region →</Link>
          </p>
        </div>
      </main>
    </div>
  );
}