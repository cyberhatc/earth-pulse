import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BackendDossier, DossierPhoto, DossierScene } from "../lib/api";
import { dossierReportUrl, fetchDossier } from "../lib/api";
import { ForecastBand, yearOf } from "./ForecastBand";
import { PointParameterAnalysis } from "./PointParameterAnalysis";
import { TrendChart } from "./TrendChart";
import "../styles/dossier.css";

type Props = {
  lat: number;
  lon: number;
  regionName: string;
  regionSlug: string;
  pinned: boolean;
};

const GIBS_LABELS: Record<string, string> = {
  true_color: "True colour",
  false_color: "False colour (7-2-1)",
  ndvi: "NDVI (monthly)",
  evi: "EVI (monthly)",
  lst_day: "Land-surface temperature — day",
  lst_night: "Land-surface temperature — night",
  snow: "Snow extent",
  aerosol: "Aerosol optical depth",
  no2: "Nitrogen dioxide column",
  so2: "Sulphur dioxide column",
  co: "Carbon monoxide",
  precipitation: "IMERG precipitation",
  soil_moisture: "GLDAS soil moisture",
  viirs_true_color: "VIIRS true colour",
  viirs_false_color: "VIIRS false colour (M11-I2-I1)",
  viirs_lst_day: "VIIRS land-surface temperature — day",
  ndsi: "MODIS NDSI snow cover",
  viirs_ndsi: "VIIRS NDSI snow cover",
  snow_pct: "Monthly snow-cover fraction",
  snow_mass: "SMAP snow mass",
  snow_water_equivalent: "AMSR2 snow water equivalent",
  gldas_air_temperature: "GLDAS near-surface air temperature",
  gldas_precipitation: "GLDAS total precipitation rate",
};

const CHART_PARAMS = [
  "temperature",
  "precipitation",
  "ndvi",
  "lst_day",
  "soil_moisture_surface",
  "aerosol_optical_depth",
  "pm2_5",
];

const FORECAST_PARAMS = ["temperature", "precipitation", "ndvi", "lst_day"];

function sanitize(values: (number | null)[]): number[] | null {
  const out = values.map((v) =>
    typeof v === "number" && Number.isFinite(v) ? v : NaN,
  );
  const finiteIdx = out
    .map((v, i) => (Number.isFinite(v) ? i : -1))
    .filter((i) => i >= 0);
  if (finiteIdx.length < 12) return null;
  for (let i = 0; i < out.length; i += 1) {
    if (Number.isFinite(out[i])) continue;
    const prev = finiteIdx.filter((idx) => idx < i).pop();
    const next = finiteIdx.find((idx) => idx > i);
    if (prev !== undefined && next !== undefined) {
      out[i] = out[prev] + ((out[next] - out[prev]) * (i - prev)) / (next - prev);
    } else if (prev !== undefined) {
      out[i] = out[prev];
    } else if (next !== undefined) {
      out[i] = out[next];
    }
  }
  return out.every((v) => Number.isFinite(v)) ? out : null;
}

function sceneList(
  value: DossierScene[] | { error?: string } | undefined,
): DossierScene[] {
  return Array.isArray(value) ? value : [];
}

function formatNumber(v: number | undefined, digits = 3): string {
  if (v === undefined || !Number.isFinite(v)) return "—";
  return Math.abs(v) >= 100 ? v.toFixed(1) : v.toFixed(digits);
}

export function PointDossier({ lat, lon, regionName, regionSlug, pinned }: Props) {
  const [data, setData] = useState<BackendDossier | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const rebuildOnce = useRef(false);

  const load = useCallback(
    (signal?: AbortSignal, rebuild = false) => {
      setStatus("loading");
      setError(null);
      fetchDossier(lat, lon, 60, regionSlug, signal, rebuild)
        .then((d) => {
          if (signal?.aborted) return;
          setData(d);
          setStatus("ready");
        })
        .catch((err: unknown) => {
          if (signal?.aborted) return;
          if ((err as Error)?.name === "AbortError") return;
          setError((err as Error)?.message ?? "Dossier request failed");
          setStatus("error");
        });
    },
    [lat, lon, regionSlug],
  );

  useEffect(() => {
    const controller = new AbortController();
    const rebuild = rebuildOnce.current;
    rebuildOnce.current = false;
    load(controller.signal, rebuild);
    return () => controller.abort();
  }, [load, nonce]);

  const nextMoveEntries = useMemo(
    () =>
      Object.entries(data?.next_move ?? {})
        .filter(([, mv]) => Number.isFinite(mv.delta_over_horizon))
        .sort((a, b) => Math.abs(b[1].delta_over_horizon) - Math.abs(a[1].delta_over_horizon))
        .slice(0, 12),
    [data],
  );

  const parameterGroups = useMemo(() => data?.parameter_groups ?? [], [data]);
  const gibsLabels = useMemo(
    () => ({ ...GIBS_LABELS, ...(data?.imagery.gibs_labels ?? {}) }),
    [data],
  );
  const gibsOrder = useMemo(() => {
    const order = new Map<string, number>();
    let index = 0;
    for (const group of data?.imagery.gibs_groups ?? []) {
      for (const layer of group.layers) {
        order.set(layer, index);
        index += 1;
      }
    }
    return order;
  }, [data]);

  const chartSeries = useCallback(
    (param: string) => {
      const raw = data?.history.series[param] ?? [];
      const dates = data?.history.dates ?? [];
      if (!raw.length || !dates.length) return null;
      let first = -1;
      let last = -1;
      for (let i = 0; i < raw.length; i += 1) {
        const v = raw[i];
        if (typeof v === "number" && Number.isFinite(v)) {
          if (first < 0) first = i;
          last = i;
        }
      }
      if (first < 0 || last < first) return null;
      const values = sanitize(raw.slice(first, last + 1));
      if (!values) return null;
      return {
        values,
        period: [
          Number(dates[first].slice(0, 4)),
          Number(dates[last].slice(0, 4)),
        ] as [number, number],
      };
    },
    [data],
  );

  const trendEntries = useMemo(
    () =>
      Object.entries(data?.trends ?? {})
        .filter(
          ([, t]) =>
            Number.isFinite(t.slope_per_decade) &&
            (t.n ?? 0) >= 12 &&
            !/no data|insufficient/i.test(t.direction ?? ""),
        )
        .sort((a, b) => Math.abs(b[1].slope_per_decade) - Math.abs(a[1].slope_per_decade)),
    [data],
  );

  const imagery = data?.imagery;
  const gibsByLayer = useMemo(() => {
    const map = new Map<string, DossierPhoto[]>();
    for (const shot of imagery?.gibs ?? []) {
      const arr = map.get(shot.layer) ?? [];
      arr.push(shot);
      map.set(shot.layer, arr);
    }
    return Array.from(map.entries());
  }, [imagery]);

  const gibsVisible = useMemo(
    () =>
      gibsByLayer
        .filter(([layer]) => layer !== "snow" || Math.abs(lat) > 25)
        .sort(
          (a, b) =>
            (gibsOrder.get(a[0]) ?? 999) - (gibsOrder.get(b[0]) ?? 999),
        ),
    [gibsByLayer, gibsOrder, lat],
  );

  const satellites = useMemo(() => {
    const scenes = imagery?.satellite_scenes ?? {};
    return Object.entries(scenes)
      .map(([collection, value]) => ({ collection, items: sceneList(value).slice(0, 4) }))
      .filter((entry) => entry.items.length > 0);
  }, [imagery]);

  const startYear = data?.coverage?.time_range?.[0]?.slice(0, 4);
  const endYear = data?.coverage?.time_range?.[1]?.slice(0, 4);
  const months = data?.history.dates.length ?? 0;
  const omSource = data?.cross_check?.sources?.["Open-Meteo (ERA5)"];
  const gistemp = data?.cross_check?.gistemp;
  const ml = data?.ml;
  const backtest = ml?.backtest;
  const usedSources = useMemo(
    () =>
      (data?.sources ?? [])
        .filter((s) => s.status === "used" || s.status === "context")
        .map((s) => s.name),
    [data],
  );
  const crossRows = useMemo(() => {
    const rows: {
      source: string;
      key: string;
      slope: number;
      p: number;
      sig: boolean;
    }[] = [];
    for (const [source, block] of Object.entries(data?.cross_check?.sources ?? {})) {
      for (const [key, t] of Object.entries(block.trends ?? {})) {
        rows.push({
          source,
          key,
          slope: t.slope_per_decade,
          p: t.p_value,
          sig: t.significant,
        });
      }
    }
    return rows;
  }, [data]);
  const backtestRows = backtest?.per_parameter
    ? Object.entries(backtest.per_parameter)
    : [];

  return (
    <section className="dossier" aria-label="Detailed location dossier">
      <div className="dossier-head">
        <div>
          <p className="eyebrow">Detailed Location Dossier</p>
          <h2 className="dossier-title">
            {regionName} · {pinned ? "pinned coordinate" : "regional centre"}
          </h2>
          <p className="dossier-sub">
            {lat.toFixed(4)}°, {lon.toFixed(4)}° · {startYear ?? "—"}–{endYear ?? "—"} ·{" "}
            {data?.area ? "10 × 10 km box · " : ""}
            {data?.mode === "point_real"
              ? "real NASA POWER point record"
              : "gridded demo analysis"}
          </p>
        </div>
        <div className="dossier-actions">
          <a
            className="btn-secondary"
            href={dossierReportUrl(
              lat,
              lon,
              data?.forecast.horizon_months ?? 60,
              regionSlug,
            )}
            target="_blank"
            rel="noreferrer"
          >
            Open visual report ↗
          </a>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              rebuildOnce.current = true;
              setNonce((n) => n + 1);
            }}
            disabled={status === "loading"}
          >
            {status === "loading" ? "Analysing…" : "Rebuild analysis"}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              if (!data) return;
              const blob = new Blob([JSON.stringify(data, null, 2)], {
                type: "application/json;charset=utf-8",
              });
              const href = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = href;
              a.download = `dossier-${regionSlug}-${lat.toFixed(3)}_${lon.toFixed(3)}.json`;
              a.click();
              URL.revokeObjectURL(href);
            }}
            disabled={!data}
          >
            Export dossier JSON
          </button>
        </div>
      </div>

      {status === "loading" && (
        <p className="dossier-status">
          Fetching NASA POWER, ERA5 (Open-Meteo), GISTEMP and satellite scene references,
          then training the local ridge model (a new coordinate can take ~30–60 s; cached
          afterwards). Charts below update when it finishes.
        </p>
      )}

      {status === "error" && (
        <p className="dossier-status dossier-status-error">
          {error ?? "Dossier unavailable."}
        </p>
      )}

      {data && (
        <>
          <div className="dossier-badges">
            <span className={`dossier-badge ${data.mode === "point_real" ? "is-live" : "is-demo"}`}>
              {data.mode === "point_real" ? "REAL NASA POWER" : "GRID DEMO (SYNTHETIC)"}
            </span>
            {data.provenance.built_now && (
              <span className="dossier-badge">BUILT THIS REQUEST</span>
            )}
            <span className="dossier-badge">
              {data.forecast.horizon_months}-month forecast
            </span>
            <span className="dossier-badge">
              {data.anomalies.length} anomalies
            </span>
            <span className="dossier-badge">
              generated {data.provenance.generated_utc.replace("T", " ")} UTC
            </span>
          </div>

          {data.warnings.length > 0 && (
            <ul className="dossier-warn">
              {data.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}

          {data.satellite?.pending && (
            <p className="dossier-status">
              MODIS NDVI/EVI/LST/ET series is backfilling for this coordinate in the
              background (Planetary Computer, free and no login). POWER/ERA5/CAMS and
              all satellite imagery are already available; reload this dossier in a
              few minutes to see the MODIS time series.
            </p>
          )}

          <PointParameterAnalysis
            data={data}
            lat={lat}
            lon={lon}
            regionName={regionName}
            regionSlug={regionSlug}
          />

          <div className="dossier-grid">
            <article className="dossier-card">
              <header className="dossier-card-head">
                <h3>Trend statistics</h3>
                <span>Theil–Sen slope / decade · Mann–Kendall</span>
              </header>
              <div className="dossier-table-wrap">
                <table className="dossier-table">
                  <thead>
                    <tr>
                      <th>Parameter</th>
                      <th>Slope / decade</th>
                      <th>p-value</th>
                      <th>Significant</th>
                      <th>n</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trendEntries.map(([key, t]) => (
                      <tr key={key}>
                        <td>{data.parameters[key]?.label ?? key}</td>
                        <td>
                          {t.slope_per_decade >= 0 ? "+" : "−"}
                          {formatNumber(Math.abs(t.slope_per_decade))}{" "}
                          {data.parameters[key]?.unit ?? ""}
                        </td>
                        <td>{formatNumber(t.p_value, 4)}</td>
                        <td>
                          <span
                            className={`dossier-dot ${t.significant ? "is-sig" : ""}`}
                            aria-hidden="true"
                          />
                          {t.significant ? "yes (α=0.05)" : "no"}
                        </td>
                        <td>{t.n ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="dossier-card">
              <header className="dossier-card-head">
                <h3>Explanation</h3>
                <span>{data.explanation.generator}</span>
              </header>
              <p className="dossier-copy">{data.explanation.text}</p>
              <dl className="dossier-kv">
                <div>
                  <dt>Forecast model</dt>
                  <dd>{data.forecast.model ?? "—"}</dd>
                </div>
                <div>
                  <dt>Sources used</dt>
                  <dd>{usedSources.length ? usedSources.join(", ") : "—"}</dd>
                </div>
                <div>
                  <dt>Parameters</dt>
                  <dd>
                    {Array.isArray(data.coverage.parameters_used)
                      ? data.coverage.parameters_used.join(", ")
                      : "—"}
                  </dd>
                </div>
              </dl>
            </article>
          </div>

          {data.area && (
            <article className="dossier-card">
              <header className="dossier-card-head">
                <h3>Area of interest</h3>
                <span>nominal 10 × 10 km box centred on the point</span>
              </header>
              <dl className="dossier-kv dossier-kv-wide">
                <div>
                  <dt>Bounding box (S, W, N, E)</dt>
                  <dd>{data.area.bbox.map((v) => v.toFixed(4)).join(", ")}</dd>
                </div>
                <div>
                  <dt>Nominal size</dt>
                  <dd>
                    {data.area.width_km} × {data.area.height_km} km · ~
                    {data.area.approx_km2} km²
                  </dd>
                </div>
                <div>
                  <dt>Record analysed</dt>
                  <dd>
                    {months} months · {startYear ?? "—"}–{endYear ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt>Effective resolution</dt>
                  <dd>{data.area.resolution_note}</dd>
                </div>
              </dl>
            </article>
          )}

          <article className="dossier-card">
            <header className="dossier-card-head">
              <h3>Observed series</h3>
              <span>Monthly record · fitted robust trend</span>
            </header>
            <div className="dossier-charts">
              {CHART_PARAMS.map((param) => {
                const chart = chartSeries(param);
                const trend = data.trends[param];
                if (!chart || !trend) return null;
                return (
                  <div key={param} className="dossier-chart-block">
                    <h4>
                      {data.parameters[param]?.label ?? param}{" "}
                      <span>
                        {data.parameters[param]?.unit ?? ""} · {chart.period[0]}–
                        {chart.period[1]}
                      </span>
                    </h4>
                    <TrendChart
                      series={chart.values}
                      period={chart.period}
                      slopePerDecade={trend.slope_per_decade}
                      unit={data.parameters[param]?.unit ?? ""}
                      significant={trend.significant}
                      direction={
                        trend.slope_per_decade > 0
                          ? "up"
                          : trend.slope_per_decade < 0
                            ? "down"
                            : "flat"
                      }
                    />
                  </div>
                );
              })}
            </div>
          </article>

          <article className="dossier-card">
            <header className="dossier-card-head">
              <h3>Projected next {data.forecast.horizon_months} months</h3>
              <span>annual-mean change · p10–p90 uncertainty band</span>
            </header>
            <div className="dossier-chips">
              {nextMoveEntries.map(([key, mv]) => (
                <span key={key} className={`dossier-chip is-${mv.direction}`}>
                  {data.parameters[key]?.label ?? key}: {mv.direction}{" "}
                  <strong>
                    {mv.delta_over_horizon >= 0 ? "+" : ""}
                    {formatNumber(mv.delta_over_horizon)}{" "}
                    {data.parameters[key]?.unit ?? ""}
                  </strong>
                </span>
              ))}
            </div>
            <div className="dossier-charts">
              {FORECAST_PARAMS.filter((k) => data.forecast.timeseries[k]).map((key) => {
                const band = data.forecast.timeseries[key];
                return (
                <div key={key} className="dossier-chart-block">
                  <h4>
                    {data.parameters[key]?.label ?? key}{" "}
                    <span>{data.parameters[key]?.unit ?? ""}</span>
                  </h4>
                  <ForecastBand
                    dates={data.forecast.dates}
                    mean={band.mean}
                    lower={band.lower}
                    upper={band.upper}
                    unit={data.parameters[key]?.unit ?? ""}
                  />
                </div>
                );
              })}
            </div>
          </article>

          <div className="dossier-grid">
            <article className="dossier-card">
              <header className="dossier-card-head">
                <h3>ML model &amp; backtest</h3>
                <span>{ml?.model ?? data.forecast.model ?? "—"}</span>
              </header>
              <dl className="dossier-kv">
                <div>
                  <dt>Training rows</dt>
                  <dd>{ml?.n_rows ?? "—"}</dd>
                </div>
                <div>
                  <dt>Features</dt>
                  <dd>{ml?.n_features ?? "—"}</dd>
                </div>
                <div>
                  <dt>Lag window</dt>
                  <dd>{ml?.seq_len ? `${ml.seq_len} months` : "—"}</dd>
                </div>
                <div>
                  <dt>Rolling origins</dt>
                  <dd>
                    {backtest?.origins
                      ? `${backtest.origins} × ${backtest.horizon_months ?? 12} months`
                      : "—"}
                  </dd>
                </div>
              </dl>
              {backtestRows.length > 0 ? (
                <div className="dossier-table-wrap">
                  <table className="dossier-table">
                    <thead>
                      <tr>
                        <th>Parameter</th>
                        <th>MAE</th>
                        <th>RMSE</th>
                        <th>p10–p90 coverage</th>
                        <th>Skill vs persistence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {backtestRows.map(([key, m]) => (
                        <tr key={key}>
                          <td>{data.parameters[key]?.label ?? key}</td>
                          <td>{formatNumber(m.mae)}</td>
                          <td>{formatNumber(m.rmse)}</td>
                          <td>{formatNumber(m.picp_p10_p90, 2)}</td>
                          <td>
                            {m.skill_vs_persistence === null
                              ? "—"
                              : formatNumber(m.skill_vs_persistence, 2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="dossier-copy">
                  No rolling backtest metrics for this record.
                </p>
              )}
              {ml?.note && (
                <p className="dossier-copy dossier-copy-small">{ml.note}</p>
              )}
              {ml?.short_record_params && ml.short_record_params.length > 0 && (
                <p className="dossier-copy dossier-copy-small">
                  Short-record parameters use the transparent linear/seasonal
                  forecast instead of the 45-year ridge model:{" "}
                  {ml.short_record_params
                    .map((p) => data.parameters[p]?.label ?? p)
                    .join(", ")}
                  .
                </p>
              )}
            </article>

            <article className="dossier-card">
              <header className="dossier-card-head">
                <h3>Independent cross-check</h3>
                <span>ERA5 (Open-Meteo) · NASA GISTEMP</span>
              </header>
              {crossRows.length > 0 ? (
                <div className="dossier-table-wrap">
                  <table className="dossier-table">
                    <thead>
                      <tr>
                        <th>Source</th>
                        <th>Parameter</th>
                        <th>Slope / decade</th>
                        <th>p</th>
                      </tr>
                    </thead>
                    <tbody>
                      {crossRows.map((row) => (
                        <tr key={`${row.source}-${row.key}`}>
                          <td>{row.source}</td>
                          <td>{data.parameters[row.key]?.label ?? row.key}</td>
                          <td>
                            {row.slope >= 0 ? "+" : "−"}
                            {formatNumber(Math.abs(row.slope))}{" "}
                            {data.parameters[row.key]?.unit ?? ""}
                          </td>
                          <td>
                            {formatNumber(row.p, 4)}
                            {row.sig ? " · sig" : ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="dossier-copy">
                  ERA5 cross-check unavailable for this coordinate.
                </p>
              )}
              {gistemp?.available && (
                <p className="dossier-copy">
                  Global context: NASA GISTEMP {gistemp.period?.[0]}–
                  {gistemp.period?.[1]} trend{" "}
                  {formatNumber(gistemp.slope_per_decade)} °C/decade
                  {gistemp.significant ? " (significant)" : ""}; latest{" "}
                  {formatNumber(gistemp.latest_anomaly, 2)} °C in{" "}
                  {gistemp.latest_year} vs 1951–1980.
                </p>
              )}
              <p className="dossier-copy dossier-copy-small">
                Open-Meteo is an independent ERA5 reanalysis record, not a copy of
                NASA POWER. GISTEMP is global context only, not a local measurement.
              </p>
            </article>
          </div>

          <article className="dossier-card">
            <header className="dossier-card-head">
              <h3>Parameter catalogue</h3>
              <span>
                every free source parameter checked for this 10 × 10 km box
              </span>
            </header>
            <div className="dossier-table-wrap">
              <table className="dossier-table">
                <thead>
                  <tr>
                    <th>Parameter</th>
                    <th>Unit</th>
                    <th>Group</th>
                    <th>Source</th>
                    <th>Native</th>
                    <th>Coverage</th>
                    <th>Months</th>
                  </tr>
                </thead>
                <tbody>
                  {parameterGroups.map((group) => (
                    <Fragment key={group.name}>
                      <tr className="dossier-group-row">
                        <td colSpan={7}>{group.name}</td>
                      </tr>
                      {group.parameters.map((item) => {
                        const meta = data.coverage.parameter_meta?.[item.key ?? ""];
                        const n = meta?.n ?? (item.key ? data.trends[item.key]?.n : null);
                        return (
                          <tr key={item.key ?? item.label}>
                            <td>{item.label}</td>
                            <td>{item.unit}</td>
                            <td>{item.group}</td>
                            <td>{item.source}</td>
                            <td>{item.native}</td>
                            <td>{item.coverage}</td>
                            <td>{n ?? 0}</td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            {data.satellite?.note && (
              <p className="dossier-copy dossier-copy-small">
                Satellite detail: {data.satellite.note}
              </p>
            )}
          </article>

          <article className="dossier-card">
            <header className="dossier-card-head">
              <h3>Requested but unavailable here</h3>
              <span>honest gaps — no invented values</span>
            </header>
            <div className="dossier-table-wrap">
              <table className="dossier-table">
                <thead>
                  <tr>
                    <th>Parameter</th>
                    <th>Source</th>
                    <th>Why it is not in this payload</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.requested_unavailable ?? {}).map(
                    ([key, item]) => (
                      <tr key={key}>
                        <td>{item.label}</td>
                        <td>{item.source}</td>
                        <td>{item.reason}</td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </article>

          <div className="dossier-grid">
            <article className="dossier-card">
              <header className="dossier-card-head">
                <h3>Anomalies</h3>
                <span>rolling robust z ≥ 3</span>
              </header>
              {data.anomalies.length === 0 ? (
                <p className="dossier-copy">
                  No month in this record exceeds the robust-z threshold for the flagged
                  parameters.
                </p>
              ) : (
                <ul className="dossier-anomalies">
                  {data.anomalies
                    .slice()
                    .reverse()
                    .slice(0, 8)
                    .map((a) => (
                      <li key={`${a.parameter}-${a.date}-${a.z}`}>
                        <strong>{a.date}</strong> ·{" "}
                        {data.parameters[a.parameter]?.label ?? a.parameter} ·{" "}
                        {a.kind} (z={a.z}, {a.severity})
                      </li>
                    ))}
                </ul>
              )}
            </article>

            <article className="dossier-card">
              <header className="dossier-card-head">
                <h3>Data sources</h3>
                <span>status for this dossier</span>
              </header>
              <div className="dossier-table-wrap">
                <table className="dossier-table dossier-table-sources">
                  <thead>
                    <tr>
                      <th>Source</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sources.map((s) => (
                      <tr key={s.name}>
                        <td>
                          <a href={s.url} target="_blank" rel="noreferrer">
                            {s.name}
                          </a>
                        </td>
                        <td>{s.role}</td>
                        <td>
                          <span className={`source-status is-${s.status}`}>
                            {s.status}
                          </span>
                        </td>
                        <td className="dossier-source-note">{s.note ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </div>

          <article className="dossier-card">
            <header className="dossier-card-head">
              <h3>Satellite imagery</h3>
              <span>NASA GIBS frames · Sentinel-2 / Landsat scenes</span>
            </header>

            {gibsVisible.length === 0 && satellites.length === 0 && (
              <p className="dossier-copy">
                Imagery references are unavailable for this request
                {data.warnings.length ? " (see warnings above)" : ""}.
              </p>
            )}

            {gibsVisible.map(([layer, shots]) => (
              <div key={layer} className="dossier-imagery-row">
                <h4>{gibsLabels[layer] ?? layer}</h4>
                <div className="dossier-gallery">
                  {shots.map((shot) => (
                    <a
                      key={`${shot.layer}-${shot.date}`}
                      className="dossier-shot"
                      href={shot.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <img src={shot.url} alt={`${layer} ${shot.date}`} loading="lazy" />
                      <span>{shot.date}</span>
                    </a>
                  ))}
                </div>
              </div>
            ))}

            {satellites.map(({ collection, items }) => (
              <div key={collection} className="dossier-imagery-row">
                <h4>
                  {collection === "sentinel-2-l2a"
                    ? "Sentinel-2 L2A (10 m)"
                    : collection === "landsat-c2-l2"
                      ? "Landsat 8/9 L2 (30 m)"
                      : collection}
                </h4>
                <div className="dossier-gallery">
                  {items.map((scene) =>
                    scene.thumbnail ? (
                      <a
                        key={scene.id}
                        className="dossier-shot"
                        href={scene.thumbnail}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <img src={scene.thumbnail} alt={scene.id} loading="lazy" />
                        <span>
                          {yearOf(scene.datetime)}
                          {typeof scene.cloud_cover === "number"
                            ? ` · ${Math.round(scene.cloud_cover)}% cloud`
                            : ""}
                        </span>
                      </a>
                    ) : null,
                  )}
                </div>
              </div>
            ))}

            <div className="dossier-links">
              {data.imagery.links.worldview && (
                <a href={data.imagery.links.worldview} target="_blank" rel="noreferrer">
                  Open NASA Worldview ↗
                </a>
              )}
              {data.imagery.links.earthdata_search && (
                <a
                  href={data.imagery.links.earthdata_search}
                  target="_blank"
                  rel="noreferrer"
                >
                  Earthdata Search ↗
                </a>
              )}
              {data.imagery.links.power_api && (
                <a href={data.imagery.links.power_api} target="_blank" rel="noreferrer">
                  Raw NASA POWER API ↗
                </a>
              )}
              {data.imagery.links.firms && (
                <a href={data.imagery.links.firms} target="_blank" rel="noreferrer">
                  NASA FIRMS ↗
                </a>
              )}
            </div>
          </article>
        </>
      )}
    </section>
  );
}
