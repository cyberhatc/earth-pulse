import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useInvestigation } from "../lib/context";
import { getVariable } from "../lib/data";
import {
  buildEvidenceRecord,
  computeFingerprint,
  detectAnomalies,
  findEarthTwins,
  generateLocalStory,
} from "../lib/intelligence";
import {
  colorForSlope,
  formatCoords,
  formatP,
  formatSignedNumber,
  formatSlope,
  slopeAtPoint,
} from "../lib/trend";
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
  series: number[];
  stats: TrendStats;
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
  stats,
  card,
}: {
  region: Region;
  stats: TrendStats;
  card: CanvasCard;
}) {
  const evidence = useMemo(
    () => buildEvidenceRecord(region, stats, card.kind, card.point),
    [region, stats, card.kind, card.point],
  );

  return (
    <details className="evidence-drawer">
      <summary className="evidence-summary">
        <span>TRUST ME · EVIDENCE &amp; CONFIDENCE</span>
        <span className="evidence-tier">
          {evidence.confidenceLevel} confidence · {evidence.dataset.split(" ")[0]}
        </span>
      </summary>
      <div className="evidence-drawer-body">
        <EvidenceGrid evidence={evidence} />
      </div>
    </details>
  );
}

function StoryCardBody({
  region,
  stats,
}: {
  region: Region;
  stats: TrendStats;
}) {
  const [lang, setLang] = useState<StoryLanguage>("en");
  const [audience, setAudience] = useState<StoryAudience>("student");
  const [useWesternGhats, setUseWesternGhats] = useState(false);

  const fingerprint = useMemo(() => computeFingerprint(region), [region]);
  const story = useMemo(
    () =>
      generateLocalStory(
        region,
        stats,
        fingerprint,
        lang,
        audience,
        useWesternGhats,
      ),
    [region, stats, fingerprint, lang, audience, useWesternGhats],
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
  series,
  stats,
}: CardRendererProps) {
  const variable = getVariable(region.variable);
  const { setPoint } = useInvestigation();
  const navigate = useNavigate();

  if (card.kind === "fingerprint") {
    const fp = computeFingerprint(region);
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
        <EvidenceFooter region={region} stats={stats} card={card} />
      </article>
    );
  }

  if (card.kind === "anomaly") {
    const report = detectAnomalies(region, series);
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
            Hotspot {formatCoords(report.hotspot[0], report.hotspot[1], 1)}
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

          <div className="anomaly-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setPoint(report.hotspot);
                navigate(`/region/${region.slug}/map`);
              }}
            >
              Inspect hotspot on map ({formatCoords(report.hotspot[0], report.hotspot[1], 1)}) →
            </button>
          </div>
        </div>
        <EvidenceFooter region={region} stats={stats} card={card} />
      </article>
    );
  }

  if (card.kind === "earth-twins") {
    const twins = findEarthTwins(region);
    return (
      <article className="card">
        <div className="card-head">
          <span className="card-head-label">Earth Twin Finder</span>
          <span className="card-head-meta">Cross-continent match</span>
        </div>
        <div className="card-body">
          <div className="twin-list">
            {twins.map((twin) => (
              <div key={twin.slug} className="twin-row">
                <div className="twin-head">
                  <div>
                    <div className="twin-name">{twin.name}</div>
                    <div className="twin-sub">
                      {twin.continent} · {twin.climate}
                    </div>
                  </div>
                  <div className="twin-meta-inline">
                    <span className="stamp stamp-sig">
                      {twin.similarity}% match
                    </span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={`stamp ${twin.comparableDatasets ? "stamp-sig" : "stamp-not-sig"}`}
                    >
                      {twin.comparableDatasets
                        ? "Comparable data"
                        : "Partial comparability"}
                    </span>
                  </div>
                </div>

                <div className="twin-vectors">
                  {(
                    [
                      ["Temp", twin.vector.temperature],
                      ["NDVI", twin.vector.vegetation],
                      ["Rain", twin.vector.rainfall],
                      ["SST / Water", twin.vector.water],
                    ] as const
                  ).map(([label, item]) => (
                    <div key={label} className="twin-vec-cell">
                      <span className="twin-vec-label">{label}</span>
                      <span
                        className="twin-vec-val"
                        style={{
                          color:
                            item.direction === "up"
                              ? "var(--trend-up)"
                              : item.direction === "down"
                                ? "var(--trend-down)"
                                : "var(--trend-flat)",
                        }}
                      >
                        {formatSignedNumber(item.slope)}
                      </span>
                    </div>
                  ))}
                </div>

                <p className="twin-note">
                  <strong>Shared:</strong> {twin.sharedTraits.join(", ")} ·{" "}
                  <strong>Differs:</strong> {twin.differences.join(", ")}
                </p>
                <p className="twin-comp-note">{twin.comparabilityNote}</p>
              </div>
            ))}
          </div>
        </div>
        <EvidenceFooter region={region} stats={stats} card={card} />
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
        <StoryCardBody region={region} stats={stats} />
        <EvidenceFooter region={region} stats={stats} card={card} />
      </article>
    );
  }

  if (card.kind === "evidence") {
    const evidence = buildEvidenceRecord(region, stats, card.kind, card.point);
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
            {region.plate} · {region.bboxLabel} · {region.period[0]}–{region.period[1]} · Mann-Kendall{" "}
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
        <EvidenceFooter region={region} stats={stats} card={card} />
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
            {region.period[0]}–{region.period[1]}
          </span>
        </div>
        <div className="card-body">
          <TrendChart
            series={series}
            period={region.period}
            slopePerDecade={stats.slope}
            unit={variable.unit}
            significant={stats.significant}
            direction={stats.direction}
          />
        </div>
        <EvidenceFooter region={region} stats={stats} card={card} />
      </article>
    );
  }

  if (card.kind === "slope-map") {
    const [[south, west], [north, east]] = region.bounds;
    const rows = 6;
    const cols = 10;
    const cells: { key: string; color: string; title: string }[] = [];

    for (let r = rows - 1; r >= 0; r -= 1) {
      for (let c = 0; c < cols; c += 1) {
        const lat = south + ((r + 0.5) / rows) * (north - south);
        const lng = west + ((c + 0.5) / cols) * (east - west);
        const s = slopeAtPoint(lat, lng, region);
        cells.push({
          key: `${r}-${c}`,
          color: colorForSlope(s),
          title: `${formatSignedNumber(s)} ${variable.perDecadeUnit}`,
        });
      }
    }

    return (
      <article className="card">
        <div className="card-head">
          <span className="card-head-label">Where is it changing?</span>
          <span className="card-head-meta">slope of trend</span>
        </div>
        <div className="card-body">
          <div
            className="slope-grid"
            role="img"
            aria-label={`10 by 6 spatial slope grid across ${region.name}`}
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
        </div>
        <EvidenceFooter region={region} stats={stats} card={card} />
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
        <EvidenceFooter region={region} stats={stats} card={card} />
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
              This demo uses a{" "}
              {stats.significant ? "significant" : "non-significant"} mock
              result from a simplified test. Real Mann-Kendall requires
              autocorrelation correction that we&apos;ve omitted here.
            </span>
          </li>
        </ul>
      </div>
      <EvidenceFooter region={region} stats={stats} card={card} />
    </article>
  );
}
