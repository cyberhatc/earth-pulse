import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useInvestigation } from "../lib/context";
import { getVariable } from "../lib/data";
import {
  buildEvidenceRecord,
  computeFingerprint,
  generateLocalStory,
} from "../lib/intelligence";
import {
  fetchGridTrends,
  type BackendGridTrends,
} from "../lib/api";
import {
  colorForSlope,
  formatCoords,
  formatP,
  formatSignedNumber,
  formatSlope,
} from "../lib/trend";
import {
  coverageGaps,
  forecastParamFor,
  PARAM_META,
  type LiveAnalysis,
} from "../lib/live";
import type {
  CanvasCard,
  EvidenceRecord,
  Region,
  StoryAudience,
  StoryLanguage,
  TrendStats,
} from "../lib/types";
import { TrendChart } from "./TrendChart";

type CardRendererProps = {
  card: CanvasCard;
  region: Region;
  analysis: LiveAnalysis;
};

function EvidenceGrid({ evidence }: { evidence: EvidenceRecord }) {
  return (
    <dl className="evidence-grid">
      <div>
        <dt>DATASET</dt>
        <dd>{evidence.dataset}</dd>
      </div>
      <div>
        <dt>SOURCE</dt>
        <dd>{evidence.source}</dd>
      </div>
      <div>
        <dt>PERIOD</dt>
        <dd>{evidence.observationPeriod}</dd>
      </div>
      <div>
        <dt>RESOLUTION</dt>
        <dd>{evidence.spatialResolution}</dd>
      </div>
      <div>
        <dt>MAGNITUDE</dt>
        <dd>{evidence.trendMagnitude}</dd>
      </div>
      <div>
        <dt>SIGNIFICANCE</dt>
        <dd>{evidence.statisticalSignificance}</dd>
      </div>
      <div>
        <dt>MISSING DATA</dt>
        <dd>{evidence.missingData}</dd>
      </div>
      <div>
        <dt>LIMITATIONS</dt>
        <dd>{evidence.limitations}</dd>
      </div>
    </dl>
  );
}

function EvidenceFooter({
  region,
  analysis,
  card,
}: {
  region: Region;
  analysis: LiveAnalysis;
  card: CanvasCard;
}) {
  const evidence = useMemo(() => {
    if (card.kind === "evidence") return analysis.evidence;
    const base = buildEvidenceRecord(
      region,
      analysis.stats,
      card.kind,
      card.point,
    );
    return { ...base, ...analysis.evidence, limitations: analysis.evidence.limitations };
  }, [region, analysis, card.kind, card.point]);

  return (
    <details className="evidence-drawer">
      <summary className="evidence-summary">
        <span className="evidence-live-row">
          <span className={`live-dot live-${analysis.status}`} aria-hidden="true" />
          {analysis.isLive ? "LIVE BACKEND" : analysis.status.toUpperCase()}
          <span className="evidence-live-source">
            {analysis.sourceLabel}
          </span>
        </span>
        <span className="evidence-tier">
          {evidence.confidenceLevel} confidence · {evidence.dataset.split(" ")[0]}
        </span>
      </summary>
      <div className="evidence-drawer-body">
        <p className="evidence-source-note">{analysis.sourceNote}</p>
        <EvidenceGrid evidence={evidence} />
      </div>
    </details>
  );
}

function StoryCardBody({
  region,
  stats,
  fingerprint,
  period,
}: {
  region: Region;
  stats: TrendStats;
  fingerprint: ReturnType<typeof computeFingerprint>;
  period: [number, number];
}) {
  const [lang, setLang] = useState<StoryLanguage>("en");
  const [audience, setAudience] = useState<StoryAudience>("student");
  const [useWesternGhats, setUseWesternGhats] = useState(false);

  const story = useMemo(
    () =>
      generateLocalStory(
        region,
        stats,
        fingerprint,
        lang,
        audience,
        useWesternGhats,
        period,
      ),
    [region, stats, fingerprint, lang, audience, useWesternGhats, period],
  );

  return (
    <div className="card-body">
      <div className="story-controls">
        <div className="story-control-group" role="group" aria-label="Story language">
          {(
            [
              ["en", "English"],
              ["hi", "हिन्दी"],
              ["kn", "ಕನ್ನಡ"],
            ] as const
          ).map(([code, label]) => (
            <button
              key={code}
              type="button"
              className={`story-btn ${lang === code ? "active" : ""}`}
              onClick={() => setLang(code)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="story-control-group" role="group" aria-label="Target audience">
          {(
            [
              ["student", "Student"],
              ["journalist", "Journalist"],
              ["researcher", "Researcher"],
            ] as const
          ).map(([aud, label]) => (
            <button
              key={aud}
              type="button"
              className={`story-btn ${audience === aud ? "active" : ""}`}
              onClick={() => setAudience(aud)}
            >
              {label}
            </button>
          ))}
        </div>

        {region.slug !== "western-ghats" ? (
          <button
            type="button"
            className={`story-btn ${useWesternGhats ? "active" : ""}`}
            onClick={() => setUseWesternGhats((v) => !v)}
          >
            {useWesternGhats ? "Western Ghats ✓" : "Compare Western Ghats"}
          </button>
        ) : null}
      </div>

      <h3 className="variable-title">{story.title}</h3>
      <p className="variable-desc">{story.body}</p>
      <p className="story-takeaway">{story.takeaway}</p>
    </div>
  );
}

export function CardRenderer({
  card,
  region,
  analysis,
}: CardRendererProps) {
  const variable = getVariable(region.variable);
  const { series, stats, period, anomalyReport, fingerprint, forecast } = analysis;
  const { setPoint } = useInvestigation();
  const navigate = useNavigate();

  // Real per-cell Theil–Sen slopes for the slope-map card (NASA POWER grid).
  // Fetched only in live mode; otherwise the card says so honestly.
  const [grid, setGrid] = useState<BackendGridTrends | null>(null);
  const [gridStatus, setGridStatus] = useState<
    "idle" | "loading" | "ready" | "unavailable"
  >("idle");
  const gridParam =
    analysis.isLive && analysis.param ? analysis.param : null;
  useEffect(() => {
    if (!gridParam) {
      setGridStatus("idle");
      return;
    }
    const controller = new AbortController();
    setGridStatus("loading");
    fetchGridTrends(gridParam, controller.signal)
      .then((g) => {
        setGrid(g);
        setGridStatus("ready");
      })
      .catch(() => setGridStatus("unavailable"));
    return () => controller.abort();
  }, [gridParam]);

  if (card.kind === "fingerprint") {
    const fp = fingerprint;
    return (
      <article className="card">
        <div className="card-head">
          <span className="card-head-label">Earth Trend Fingerprint</span>
          <span className="card-head-meta">
            {fp.significantCount} of 4 significant · {region.bboxLabel}
          </span>
        </div>
        <div className="card-body">
          <div className="fingerprint-grid">
            {fp.dimensions.map((dim) => {
              const widthPct = Math.min(
                100,
                Math.max(12, Math.round((Math.abs(dim.zScore) / 2.6) * 100)),
              );
              const colorVar =
                dim.direction === "up"
                  ? "var(--trend-up)"
                  : dim.direction === "down"
                    ? "var(--trend-down)"
                    : "var(--trend-flat)";
              return (
                <div key={dim.key} className="fp-cell">
                  <div className="fp-cell-top">
                    <span className="fp-label">{dim.label}</span>
                    <span
                      className={`stamp ${dim.significant ? "stamp-sig" : "stamp-not-sig"}`}
                    >
                      {dim.significant ? "Significant" : "Inconclusive"}
                    </span>
                  </div>
                  <div className="fp-value" style={{ color: colorVar }}>
                    {formatSignedNumber(dim.slope)} {dim.slopeUnit}
                  </div>
                  <div className="fp-bar-track" aria-hidden="true">
                    <div
                      className="fp-bar-fill"
                      style={{
                        width: `${widthPct}%`,
                        backgroundColor: colorVar,
                      }}
                    />
                  </div>
                  <div className="fp-meta">
                    <span>{formatP(dim.pValue)}</span>
                    <span>{dim.dataset}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="fp-synthesis">
            <p className="fp-synthesis-copy">{fp.coupledInsight}</p>
            <p className="fp-lead">
              <strong>Further investigation:</strong> {fp.investigationLead}
            </p>
          </div>
        </div>
        <EvidenceFooter region={region} analysis={analysis} card={card} />
      </article>
    );
  }

  if (card.kind === "anomaly") {
    const report = anomalyReport;
    const bMin = Math.min(...report.baselineByMonth);
    const bMax = Math.max(...report.baselineByMonth);
    const bRange = bMax - bMin || 1;
    const W = 520;
    const H = 110;
    const padX = 24;
    const padY = 16;
    const pts = report.baselineByMonth
      .map((val, m) => {
        const x = padX + (m / 11) * (W - padX * 2);
        const y = padY + (1 - (val - bMin) / bRange) * (H - padY * 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");

    return (
      <article className="card">
        <div className="card-head">
          <span className="card-head-label">Earth Anomaly Detective</span>
          <span className="card-head-meta">
            {report.hotspot
              ? `Analysis cell ${formatCoords(report.hotspot[0], report.hotspot[1], 1)}`
              : "Regional anomaly scan"}
          </span>
        </div>
        <div className="card-body">
          <p className="anomaly-summary">{report.summary}</p>

          <div className="anomaly-chart-box">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="anomaly-svg"
              role="img"
              aria-label="Historical 12-month seasonal cycle with detected anomaly markers"
            >
              <polyline
                fill="none"
                stroke="var(--ink-mute)"
                strokeWidth={1.5}
                strokeDasharray="3 3"
                points={pts}
              />
              {report.events.map((ev) => {
                const x = padX + (ev.month / 11) * (W - padX * 2);
                const rawNorm =
                  (ev.baselineValue + ev.departure - bMin) / bRange;
                const clampedY =
                  padY +
                  (1 - Math.min(1.15, Math.max(-0.15, rawNorm))) *
                    (H - padY * 2);
                const y = Math.min(H - 8, Math.max(8, clampedY));
                const color =
                  ev.departure >= 0 ? "var(--trend-up)" : "var(--trend-down)";
                return (
                  <g key={ev.index}>
                    <circle cx={x} cy={y} r={5} fill={color} />
                    <text
                      x={x}
                      y={Math.max(12, y - 9)}
                      textAnchor="middle"
                      className="chart-axis-label"
                    >
                      {ev.monthLabel}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="anomaly-list">
            {report.events.map((ev) => (
              <div key={ev.index} className="anomaly-row">
                <span className="anomaly-month">{ev.monthLabel}</span>
                <span
                  className="anomaly-val"
                  style={{
                    color:
                      ev.departure >= 0
                        ? "var(--trend-up)"
                        : "var(--trend-down)",
                  }}
                >
                  {formatSignedNumber(ev.departure)} {ev.unit}
                </span>
                <span className="anomaly-z">
                  z = {formatSignedNumber(ev.zScore)}
                </span>
              </div>
            ))}
          </div>

          <div className="anomaly-caution">{report.cautionNote}</div>

          {report.hotspot ? (
            <div className="anomaly-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setPoint(report.hotspot);
                  navigate(`/region/${region.slug}/map`);
                }}
              >
                Inspect this cell on map (
                {formatCoords(report.hotspot[0], report.hotspot[1], 1)}) →
              </button>
            </div>
          ) : (
            <p className="evidence-source-note">
              No coordinate to pin — connect the backend and this scan reports
              the nearest 15° POWER analysis cell.
            </p>
          )}
        </div>
        <EvidenceFooter region={region} analysis={analysis} card={card} />
      </article>
    );
  }

  if (card.kind === "earth-twins") {
    const payload = analysis.payload;
    const backendTwin = payload?.climate_twin ?? null;
    const opposites = analysis.opposite;
    return (
      <article className="card">
        <div className="card-head">
          <span className="card-head-label">Earth Twin Finder</span>
          <span className="card-head-meta">
            {analysis.isLive ? "Backend · NASA POWER" : "Backend offline"}
          </span>
        </div>
        <div className="card-body">
          {analysis.isLive && backendTwin ? (
            <div className="twin-list">
              <div className="twin-row">
                <div className="twin-head">
                  <div>
                    <div className="twin-name">
                      Climate twin cluster {backendTwin.cluster_id ?? "—"} of{" "}
                      {backendTwin.k}
                    </div>
                    <div className="twin-sub">
                      k-means over standardised cell climatology (
                      {(backendTwin.features || []).join(", ") ||
                        "temperature_mean, precipitation_mean"}
                      ). NDVI and SST are excluded — NASA POWER does not
                      provide them.
                    </div>
                  </div>
                  <div className="twin-meta-inline">
                    <span className="stamp stamp-sig">NASA POWER</span>
                  </div>
                </div>
                <p className="twin-note">
                  Every cell in this cluster shares statistically similar 1981–present
                  temperature and precipitation climatology. Twins are computed
                  from the same store as the rest of this dossier — no external
                  satellite catalog is substituted.
                </p>
              </div>
              {opposites.length > 0 && (
                <>
                  <div className="twin-head">
                    <div>
                      <div className="twin-name">
                        Opposite-direction neighbours (measured)
                      </div>
                      <div className="twin-sub">
                        Nearest 15° POWER cells trending against each other —
                        from the engine&apos;s opposite-trend detector, not a catalog.
                      </div>
                    </div>
                  </div>
                  {opposites.map((o, i) => (
                    <div key={`${o.parameter}-${i}`} className="twin-row">
                      <div className="twin-head">
                        <div>
                          <div className="twin-name">
                            {o.parameter === "precipitation" ? "Rainfall" : o.parameter}
                          </div>
                          <div className="twin-sub">strength: {o.strength}</div>
                        </div>
                      </div>
                      <div className="twin-vectors">
                        {[o.cell_a, o.cell_b].map((cell, j) => (
                          <div key={j} className="twin-vec-cell">
                            <span className="twin-vec-label">
                              {formatCoords(cell.lat, cell.lon, 1)}
                            </span>
                            <span className="twin-vec-val">
                              {formatSignedNumber(cell.slope_per_decade)}
                              {o.parameter === "precipitation"
                                ? " mm/mo/dec"
                                : " °C/dec"}
                              {cell.significant ? " ✓" : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                      {o.note && <p className="twin-note">{o.note}</p>}
                    </div>
                  ))}
                </>
              )}
            </div>
          ) : (
            <p className="evidence-source-note">
              The Earth Twin Finder clusters NASA POWER grid cells, so it needs
              the live backend. With the backend offline there is no measured
              twin candidate to show, and no reference catalog is substituted.
            </p>
          )}
          <p className="evidence-source-note">
            Twins: k-means on standardised 1981–present cell temperature and
            precipitation means (NASA POWER). Opposites: neighbouring 15° cells
            with opposite Theil–Sen rainfall slopes. Neither list is a causal claim.
          </p>
        </div>
        <EvidenceFooter region={region} analysis={analysis} card={card} />
      </article>
    );
  }

  if (card.kind === "story") {
    return (
      <article className="card">
        <div className="card-head">
          <span className="card-head-label">Local Earth Stories</span>
          <span className="card-head-meta">EN · हिन्दी · ಕನ್ನಡ</span>
        </div>
        <StoryCardBody
          region={region}
          stats={stats}
          fingerprint={fingerprint}
          period={period}
        />
        <EvidenceFooter region={region} analysis={analysis} card={card} />
      </article>
    );
  }

  if (card.kind === "evidence") {
    const evidence = analysis.evidence;
    return (
      <article className="card">
        <div className="card-head">
          <span className="card-head-label">
            Trust Me · Evidence &amp; Confidence
          </span>
          <span className="card-head-meta">
            {evidence.confidenceLevel} confidence
          </span>
        </div>
        <div className="card-body">
          <EvidenceGrid evidence={evidence} />
        </div>
      </article>
    );
  }

  if (card.kind === "finding") {
    const verb =
      stats.direction === "up"
        ? "rising"
        : stats.direction === "down"
          ? "falling"
          : "stable";
    const valueColorClass =
      stats.direction === "up"
        ? "val-up"
        : stats.direction === "down"
          ? "val-down"
          : "val-flat";

    return (
      <article className="card">
        <div className="card-head">
          <span className="card-head-label">The finding</span>
          <span
            className={`stamp ${stats.significant ? "stamp-sig" : "stamp-not-sig"}`}
          >
            {stats.significant ? "Significant trend" : "Not significant"}
          </span>
        </div>
        <div className="card-body card-body-finding">
          <h3 className="finding-title">
            {variable.name} across {region.name} is <em>{verb}</em> at{" "}
            {formatSlope(stats)}.
          </h3>
          <p className="finding-sub">
            {region.plate} · {region.bboxLabel} · {period[0]}–{period[1]} · Mann-Kendall{" "}
            {formatP(stats.pValue)}
          </p>
          <div className="finding-stats">
            <div className="stat-cell">
              <div className="stat-label">RATE</div>
              <div className={`stat-value ${valueColorClass}`}>
                {formatSlope(stats)}
              </div>
            </div>
            <div className="stat-cell">
              <div className="stat-label">SIGNIFICANCE</div>
              <div className="stat-value">{formatP(stats.pValue)}</div>
            </div>
            <div className="stat-cell">
              <div className="stat-label">95% CI</div>
              <div className="stat-value">
                {formatSignedNumber(stats.ciLow)} →{" "}
                {formatSignedNumber(stats.ciHigh)}
              </div>
            </div>
            <div className="stat-cell">
              <div className="stat-label">RECORDS</div>
              <div className="stat-value">{series.length}</div>
            </div>
          </div>
        </div>
        <EvidenceFooter region={region} analysis={analysis} card={card} />
      </article>
    );
  }

  if (card.kind === "trend-chart") {
    return (
      <article className="card">
        <div className="card-head">
          <span className="card-head-label">
            Time series · {variable.shortName}
          </span>
          <span className="card-head-meta">
            {period[0]}–{period[1]}
          </span>
        </div>
        <div className="card-body">
          <TrendChart
            series={series}
            period={period}
            slopePerDecade={stats.slope}
            unit={variable.unit}
            significant={stats.significant}
            direction={stats.direction}
          />
        </div>
        <EvidenceFooter region={region} analysis={analysis} card={card} />
      </article>
    );
  }

  if (card.kind === "slope-map") {
    const [[south, west], [north, east]] = region.bounds;
    const rows = 6;
    const cols = 10;
    const gridCells = grid?.cells ?? [];
    const meta = gridParam ? PARAM_META[gridParam] : null;
    const unit = meta ? `${meta.unit}/decade` : variable.perDecadeUnit;

    // Every tile's colour is the REAL slope of the nearest measured
    // 15° NASA POWER analysis cell — no invented values.
    const nearestCell = (lat: number, lng: number) => {
      let best = null as (typeof gridCells)[number] | null;
      let bestD = Infinity;
      for (const cell of gridCells) {
        const d = (cell.lat - lat) ** 2 + (cell.lon - lng) ** 2;
        if (d < bestD) {
          bestD = d;
          best = cell;
        }
      }
      return best;
    };

    const cells: { key: string; color: string; title: string }[] = [];
    for (let r = rows - 1; r >= 0; r -= 1) {
      for (let c = 0; c < cols; c += 1) {
        const lat = south + ((r + 0.5) / rows) * (north - south);
        const lng = west + ((c + 0.5) / cols) * (east - west);
        const cell = nearestCell(lat, lng);
        cells.push({
          key: `${r}-${c}`,
          color: cell ? colorForSlope(cell.slope_per_decade) : "var(--trend-flat)",
          title: cell
            ? `cell ${formatCoords(cell.lat, cell.lon, 0)}: ${formatSignedNumber(cell.slope_per_decade)} ${unit} (p = ${cell.p_value.toFixed(3)}${cell.significant ? ", significant" : ""})`
            : "Backend offline — no measured slope available",
        });
      }
    }

    return (
      <article className="card">
        <div className="card-head">
          <span className="card-head-label">Where is it changing?</span>
          <span className="card-head-meta">
            {gridStatus === "ready"
              ? `measured · ${grid?.n_cells ?? 0} POWER cells · 15° grid`
              : gridStatus === "loading"
                ? "loading measured slopes…"
                : "backend offline"}
          </span>
        </div>
        <div className="card-body">
          <div
            className="slope-grid"
            role="img"
            aria-label={`10 by 6 schematic grid across ${region.name}; each tile coloured by the nearest measured POWER cell slope`}
          >
            {cells.map((cell) => (
              <div
                key={cell.key}
                className="slope-cell"
                style={{ backgroundColor: cell.color }}
                title={cell.title}
              />
            ))}
          </div>
          <div className="slope-legend">
            <span className="legend-item">
              <span
                className="slope-dot"
                style={{ backgroundColor: "var(--trend-down)" }}
                aria-hidden="true"
              />
              <span>Decreasing</span>
            </span>
            <span className="legend-item">
              <span
                className="slope-dot"
                style={{ backgroundColor: "var(--trend-flat)" }}
                aria-hidden="true"
              />
              <span>No change</span>
            </span>
            <span className="legend-item">
              <span
                className="slope-dot"
                style={{ backgroundColor: "var(--trend-up)" }}
                aria-hidden="true"
              />
              <span>Increasing</span>
            </span>
          </div>
          <p className="evidence-source-note">
            {gridStatus === "ready" ? (
              <>
                Each tile shows the slope of the <strong>nearest measured 15° NASA POWER
                analysis cell</strong> (Theil–Sen, {grid?.time_range?.[0]}–
                {grid?.time_range?.[1]}). Tile positions are schematic; the colours
                and values are real backend measurements, never generated locally.
              </>
            ) : (
              <>
                Backend offline — no measured slopes to show. Connect the backend;
                this card never substitutes synthetic inventions for data.
              </>
            )}
          </p>
        </div>
        <EvidenceFooter region={region} analysis={analysis} card={card} />
      </article>
    );
  }

  if (card.kind === "variable") {
    return (
      <article className="card">
        <div className="card-head">
          <span className="card-head-label">
            Variable · {variable.shortName}
          </span>
        </div>
        <div className="card-body">
          <h3 className="variable-title">{variable.name}</h3>
          <p className="variable-desc">{variable.description}</p>
          <dl className="variable-meta">
            <dt>UNITS</dt>
            <dd>{variable.unit}</dd>
            <dt>SOURCE</dt>
            <dd>{variable.mission}</dd>
          </dl>
        </div>
        <EvidenceFooter region={region} analysis={analysis} card={card} />
      </article>
    );
  }

  if (card.kind === "forecast") {
    const param = forecastParamFor(region, analysis);
    const block = forecast && param ? forecast.timeseries[param] : null;
    const meta = param ? PARAM_META[param] : null;
    const backtestMetric =
      forecast?.backtest?.per_parameter?.[param ?? ""] ?? forecast?.backtest ?? null;
    if (!forecast || !block || !param || !meta) {
      return (
        <article className="card">
          <div className="card-head">
            <span className="card-head-label">Forecast</span>
          </div>
          <div className="card-body">
            <p className="anomaly-summary">
              No forecast was returned by the backend for this location.
            </p>
          </div>
          <EvidenceFooter region={region} analysis={analysis} card={card} />
        </article>
      );
    }
    const W = 760;
    const H = 230;
    const padL = 48;
    const padR = 16;
    const padT = 16;
    const padB = 30;
    const all = [...block.lower, ...block.upper, ...block.mean].filter(
      (v) => Number.isFinite(v),
    );
    const min = all.length ? Math.min(...all) : 0;
    const max = all.length ? Math.max(...all) : 1;
    const range = max - min || 1;
    const toX = (i: number) =>
      padL + (i / Math.max(1, block.mean.length - 1)) * (W - padL - padR);
    const toY = (v: number) =>
      padT + (1 - (v - min) / range) * (H - padT - padB);
    const meanPath = block.mean
      .map((v, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`)
      .join(" ");
    const bandPath = [
      ...block.upper.map(
        (v, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`,
      ),
      ...[...block.lower]
        .reverse()
        .map(
          (v, i) =>
            `L${toX(block.lower.length - 1 - i).toFixed(1)},${toY(v).toFixed(1)}`,
        ),
      "Z",
    ].join(" ");
    return (
      <article className="card">
        <div className="card-head">
          <span className="card-head-label">
            Forecast · next {forecast.horizon_months} months
          </span>
          <span className="card-head-meta">
            {forecast.model}
            {forecast.artifact ? ` · ${forecast.artifact}` : ""}
          </span>
        </div>
        <div className="card-body">
          <div className="forecast-summary">
            <span className="forecast-param">{meta.label}</span>
            <span className={`live-dot live-${analysis.status}`} aria-hidden="true" />
            <span>{analysis.isLive ? "backend model" : "backend needed"}</span>
          </div>
          <div className="trend-chart">
            <div className="trend-chart-frame">
              <svg
                viewBox={`0 0 ${W} ${H}`}
                className="trend-chart-svg"
                role="img"
                aria-label={`Projected ${meta.label} with p10–p90 band`}
              >
                <path d={bandPath} fill="var(--accent-soft)" opacity={0.55} />
                <path
                  d={meanPath}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth={2}
                />
                <line
                  x1={padL}
                  y1={toY(min)}
                  x2={W - padR}
                  y2={toY(min)}
                  stroke="var(--line)"
                  strokeDasharray="2 4"
                />
                <line
                  x1={padL}
                  y1={toY(max)}
                  x2={W - padR}
                  y2={toY(max)}
                  stroke="var(--line)"
                  strokeDasharray="2 4"
                />
                <text x={padL - 8} y={toY(max) + 3} textAnchor="end" className="chart-axis-label">
                  {max.toFixed(1)}
                </text>
                <text x={padL - 8} y={toY(min) + 3} textAnchor="end" className="chart-axis-label">
                  {min.toFixed(1)}
                </text>
                <text x={padL} y={H - 8} className="chart-axis-label">
                  {forecast.dates[0]}
                </text>
                <text
                  x={W - padR}
                  y={H - 8}
                  textAnchor="end"
                  className="chart-axis-label"
                >
                  {forecast.dates[forecast.dates.length - 1]}
                </text>
              </svg>
            </div>
            <div className="chart-legend">
              <div className="chart-legend-items">
                <span className="legend-item">
                  <span className="legend-swatch" style={{ backgroundColor: "var(--accent)" }} />
                  <span>Projected mean</span>
                </span>
                <span className="legend-item">
                  <span className="legend-swatch" style={{ backgroundColor: "var(--accent-soft)" }} />
                  <span>p10–p90 band</span>
                </span>
              </div>
              <span className="chart-legend-unit">Units: {meta.unit}</span>
            </div>
          </div>
          <dl className="forecast-meta">
            <div>
              <dt>ISSUED</dt>
              <dd>{forecast.issued}</dd>
            </div>
            <div>
              <dt>BACKTEST MAE · {meta.shortLabel.toUpperCase()}</dt>
              <dd>
                {backtestMetric?.mae != null
                  ? `${backtestMetric.mae} ${meta.unit}`
                  : "n/a"}
              </dd>
            </div>
            <div>
              <dt>PICP (p10–p90)</dt>
              <dd>
                {backtestMetric?.picp_p10_p90 != null
                  ? `${Math.round(backtestMetric.picp_p10_p90 * 100)}%`
                  : "n/a"}
              </dd>
            </div>
          </dl>
          <p className="anomaly-caution">
            Probabilistic outlook, not a certain future. The band is the backend&apos;s
            p10–p90 interval; backtest metrics are the 12-month rolling-origin
            score for {meta.shortLabel.toLowerCase()} only.
          </p>
        </div>
        <EvidenceFooter region={region} analysis={analysis} card={card} />
      </article>
    );
  }

  if (card.kind === "opposite") {
    const pairs = analysis.opposite.slice(0, 6);
    return (
      <article className="card">
        <div className="card-head">
          <span className="card-head-label">Opposite Trend Detector</span>
          <span className="card-head-meta">
            {analysis.isLive ? "live engine output" : "backend needed"}
          </span>
        </div>
        <div className="card-body">
          {pairs.length === 0 ? (
            <p className="anomaly-summary">
              The backend found no neighbouring cells with opposite-sign trends
              for this location.
            </p>
          ) : (
            <div className="opposite-list">
              {pairs.map((pair, index) => (
                <div key={`${pair.parameter}-${index}`} className="opposite-row">
                  <div className="opposite-head">
                    <span className="opposite-param">{pair.parameter}</span>
                    <span
                      className={`stamp ${pair.strength === "strong" ? "stamp-sig" : "stamp-not-sig"}`}
                    >
                      {pair.strength} pair
                    </span>
                  </div>
                  <div className="opposite-cells">
                    <span>
                      A {pair.cell_a.lat.toFixed(1)}°, {pair.cell_a.lon.toFixed(1)}° ·{" "}
                      {formatSignedNumber(pair.cell_a.slope_per_decade)}
                    </span>
                    <span className="opposite-vs">vs</span>
                    <span>
                      B {pair.cell_b.lat.toFixed(1)}°, {pair.cell_b.lon.toFixed(1)}° ·{" "}
                      {formatSignedNumber(pair.cell_b.slope_per_decade)}
                    </span>
                  </div>
                  {pair.note ? (
                    <p className="twin-comp-note">{pair.note}</p>
                  ) : null}
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setPoint([pair.cell_a.lat, pair.cell_a.lon]);
                      navigate(`/region/${region.slug}/map`);
                    }}
                  >
                    Inspect cell A on map →
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <EvidenceFooter region={region} analysis={analysis} card={card} />
      </article>
    );
  }

  if (card.kind === "coverage") {
    const coverage = analysis.coverage;
    const gaps = coverageGaps(coverage);
    return (
      <article className="card">
        <div className="card-head">
          <span className="card-head-label">Data Coverage &amp; Provenance</span>
          <span className="card-head-meta">
            {coverage?.synthetic_demo ? "synthetic demo" : "real NASA record"}
          </span>
        </div>
        <div className="card-body">
          {!coverage ? (
            <p className="anomaly-summary">
              Backend payload unavailable. Start FastAPI on port 8000 and use the
              retry control in the top bar.
            </p>
          ) : (
            <>
              <dl className="forecast-meta">
                <div>
                  <dt>TIME RANGE</dt>
                  <dd>{coverage.time_range.join(" → ")}</dd>
                </div>
                <div>
                  <dt>GRID CELL</dt>
                  <dd>
                    {analysis.payload?.location.grid_lat}°,{" "}
                    {analysis.payload?.location.grid_lon}°
                  </dd>
                </div>
                <div>
                  <dt>OCEAN CELL</dt>
                  <dd>
                    {coverage.ocean_cell == null
                      ? "unknown"
                      : coverage.ocean_cell
                        ? "yes"
                        : "no"}
                  </dd>
                </div>
              </dl>
              <div className="coverage-columns">
                <div>
                  <div className="coverage-label">AVAILABLE</div>
                  <p>{(coverage.parameters_used || []).join(", ") || "none"}</p>
                </div>
                <div>
                  <div className="coverage-label">UNAVAILABLE</div>
                  <p>{(coverage.parameters_unavailable || []).join(", ") || "none"}</p>
                </div>
              </div>
              {gaps.length > 0 ? (
                <ul className="caveat-list">
                  {gaps.map((gap) => (
                    <li key={gap}>
                      <span className="caveat-dash" aria-hidden="true">
                        —
                      </span>
                      <span>{gap}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className="evidence-source-note">
                LLM narration: {analysis.explanation?.generator || "templated"}
                {analysis.explanation?.model ? ` (${analysis.explanation.model})` : ""}.
                Numbers are computed by the backend; the LLM only rewords them.
              </p>
            </>
          )}
        </div>
        <EvidenceFooter region={region} analysis={analysis} card={card} />
      </article>
    );
  }

  return (
    <article className="card">
      <div className="card-head">
        <span className="card-head-label">
          What this does &amp; doesn&apos;t mean
        </span>
      </div>
      <div className="card-body">
        <ul className="caveat-list">
          <li>
            <span className="caveat-dash" aria-hidden="true">
              —
            </span>
            <span>
              The trend measures correlation with time, not causation. Something
              else may be driving both the variable and the trend.
            </span>
          </li>
          <li>
            <span className="caveat-dash" aria-hidden="true">
              —
            </span>
            <span>
              Significance is not importance. A very small trend can be highly
              significant if there are many records; a large trend can fail
              significance if the record is short or noisy.
            </span>
          </li>
          <li>
            <span className="caveat-dash" aria-hidden="true">
              —
            </span>
            <span>
              Local trends can differ sharply from regional averages — check the
              slope map before assuming a single number tells the whole story.
            </span>
          </li>
          <li>
            <span className="caveat-dash" aria-hidden="true">
              —
            </span>
            <span>
              The backend reports this result as{" "}
              {stats.significant ? "significant" : "not significant"} using
              Mann–Kendall. A p-value above 0.05 does not prove there is no
              change — it means this record cannot confirm one. Autocorrelation
              correction is still a known limitation.
            </span>
          </li>
        </ul>
      </div>
      <EvidenceFooter region={region} analysis={analysis} card={card} />
    </article>
  );
}
