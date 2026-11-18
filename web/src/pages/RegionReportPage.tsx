import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ContextChipBar } from "../components/ContextChipBar";
import { TopBar } from "../components/TopBar";
import {
  BacktestBars,
  CoverageGrid,
  FingerprintBars,
  ForecastRibbon,
  SeriesExplorer,
  paramDisplay,
} from "../components/InteractiveCharts";
import { useInvestigation } from "../lib/context";
import { getVariable } from "../lib/data";
import { buildReportMarkdown } from "../lib/report";
import {
  formatP,
  formatSignedNumber,
  formatSlope,
} from "../lib/trend";
import { useRegionRoute } from "../lib/useRegionRoute";

export function RegionReportPage() {
  const { region } = useRegionRoute();
  const { point, live } = useInvestigation();
  const [copied, setCopied] = useState(false);

  const bundle = useMemo(() => {
    if (!region || !live.analysis) return null;
    const variable = getVariable(region.variable);
    const analysis = live.analysis;
    return {
      variable,
      analysis,
      payload: analysis.payload,
      coverage: analysis.coverage,
      stats: analysis.stats,
      fingerprint: analysis.fingerprint,
      anomalies: analysis.anomalyReport,
      evidence: analysis.evidence,
    };
  }, [region, live.analysis]);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, []);

  const handleDownload = useCallback(() => {
    if (!region || !bundle) return;
    const md = buildReportMarkdown({
      region,
      point,
      stats: bundle.stats,
      fingerprint: bundle.fingerprint,
      anomalies: bundle.anomalies,
      evidence: bundle.evidence,
      period: bundle.analysis.period,
      researchQuestion: region.teaser,
      dataStatus: bundle.analysis.isLive
        ? `Live backend · ${bundle.analysis.sourceLabel} · ${bundle.analysis.sourceNote}`
        : `${bundle.analysis.status} · ${bundle.analysis.sourceNote}`,
      trends: bundle.payload?.trends ?? null,
      coverage: bundle.coverage
        ? {
            parameters_used: bundle.coverage.parameters_used,
            parameters_unavailable: bundle.coverage.parameters_unavailable,
            sources: bundle.coverage.sources,
            synthetic_demo: bundle.coverage.synthetic_demo,
            time_range: bundle.coverage.time_range,
          }
        : null,
      forecast: bundle.analysis.forecast
        ? {
            model: bundle.analysis.forecast.model,
            horizon_months: bundle.analysis.forecast.horizon_months,
            dates: bundle.analysis.forecast.dates,
            timeseries: bundle.analysis.forecast.timeseries,
            backtest: bundle.analysis.forecast.backtest ?? null,
          }
        : null,
      shareUrl: window.location.href,
    });
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `earth-pulse-report-${region.slug}.md`;
    a.click();
    URL.revokeObjectURL(href);
  }, [bundle, point, region]);

  if (!region || !bundle) {
    return (
      <div className="workspace-page">
        <TopBar backHref="/regions" backLabel="Regions" />
      </div>
    );
  }

  const { variable, analysis, payload, coverage, stats, fingerprint, anomalies, evidence } = bundle;
  const totalMonths = payload?.past.dates.length ?? null;
  const forecastParam = (() => {
    if (!analysis.forecast) return null;
    const preferred = analysis.param;
    if (preferred && analysis.forecast.timeseries[preferred]) return preferred;
    return Object.keys(analysis.forecast.timeseries)[0] ?? null;
  })();
  const forecastUnit = forecastParam ? paramDisplay(forecastParam).unit : variable.unit;
  const maxAnomalyZ = Math.max(3.5, ...anomalies.events.map((ev) => Math.abs(ev.zScore)));
  const forecastTrend = payload?.trends
    ? Object.entries(payload.trends).filter(([, r]) => r.significant).length
    : null;

  return (
    <div className="workspace-page">
      <TopBar backHref={`/region/${region.slug}`} backLabel={region.name} />
      <ContextChipBar mode="report" />
      <main className="report-page">
        <div className="shell">
          <div className="report-head">
            <div>
              <p className="eyebrow">
                {region.plate} · VISUAL CASE REPORT · {region.bboxLabel}
              </p>
              <h1 className="report-title">The Data, in Graphs</h1>
              <p className="report-sub">
                {variable.name} · {analysis.period[0]}–{analysis.period[1]} ·{" "}
                {analysis.isLive ? (
                  <span className="report-live">live NASA POWER record</span>
                ) : (
                  <span className="report-demo">demo fallback (backend offline)</span>
                )}
                {point ? ` · pinned cell ${point[0].toFixed(2)}°, ${point[1].toFixed(2)}°` : " · regional cell"}
              </p>
            </div>
            <div className="report-actions">
              <button type="button" className="btn-secondary" onClick={() => void handleCopyLink()}>
                {copied ? "Link copied ✓" : "Copy link"}
              </button>
              <button type="button" className="btn-primary" onClick={handleDownload}>
                Download report (.md) ↓
              </button>
            </div>
          </div>

          <div className="kpi-strip" role="group" aria-label="Headline numbers">
            <div className="kpi-tile">
              <span className="kpi-label">Change per decade</span>
              <span className="kpi-value">{formatSlope(stats)}</span>
              <span className="kpi-note">{stats.direction === "up" ? "increasing" : stats.direction === "down" ? "decreasing" : "flat"} · {variable.unit}</span>
            </div>
            <div className="kpi-tile">
              <span className="kpi-label">Significance (Mann–Kendall)</span>
              <span className="kpi-value">{formatP(stats.pValue)}</span>
              <span className="kpi-note">{stats.significant ? "significant at α = 0.05" : "not significant"}{
                forecastTrend !== null ? ` · ${forecastTrend} param${forecastTrend === 1 ? "" : "s"} significant` : ""
              }</span>
            </div>
            <div className="kpi-tile">
              <span className="kpi-label">Anomalies flagged</span>
              <span className="kpi-value">{anomalies.events.length}</span>
              <span className="kpi-note">|robust z| ≥ 3.5 vs 61-mo cycle</span>
            </div>
            <div className="kpi-tile">
              <span className="kpi-label">Evidence confidence</span>
              <span className="kpi-value">{evidence.confidenceLevel}</span>
              <span className="kpi-note">{coverage ? (coverage.synthetic_demo ? "synthetic demo" : "real POWER") : "demo series"}</span>
            </div>
          </div>

          <section className="card report-card" aria-labelledby="report-s1">
            <div className="card-head">
              <span className="card-head-label" id="report-s1">1 · The monthly record — hover for exact values</span>
              <span className="card-head-meta">1981–{new Date().getFullYear()}</span>
            </div>
            <div className="card-body">
              <SeriesExplorer
                seriesByParam={payload?.past.timeseries ?? null}
                caseParam={analysis.param}
                period={analysis.period}
                slopePerDecade={stats.slope}
                fallbackSeries={analysis.series}
                fallbackParamLabel={variable.shortName}
                unit={variable.unit}
                anomalyEvents={anomalies.events}
                direction={stats.direction}
              />
            </div>
          </section>

          <div className="report-two-col">
            <section className="card report-card" aria-labelledby="report-s2">
              <div className="card-head">
                <span className="card-head-label" id="report-s2">2 · Where is each parameter heading?</span>
              </div>
              <div className="card-body">
                <FingerprintBars fingerprint={fingerprint} />
              </div>
            </section>

            <section className="card report-card" aria-labelledby="report-s3">
              <div className="card-head">
                <span className="card-head-label" id="report-s3">3 · What data do we actually have?</span>
              </div>
              <div className="card-body">
                <CoverageGrid
                  trends={payload?.trends ?? null}
                  used={coverage?.parameters_used ?? []}
                  unavailable={coverage?.parameters_unavailable ?? []}
                  totalMonths={totalMonths}
                />
              </div>
            </section>
          </div>

          <div className="report-two-col">
            <section className="card report-card" aria-labelledby="report-s4">
              <div className="card-head">
                <span className="card-head-label" id="report-s4">4 · The 5-year forecast (probabilistic)</span>
              </div>
              <div className="card-body">
                <ForecastRibbon forecast={analysis.forecast} param={forecastParam} unit={forecastUnit} />
              </div>
            </section>

            <section className="card report-card" aria-labelledby="report-s5">
              <div className="card-head">
                <span className="card-head-label" id="report-s5">5 · How good is the model? (backtest)</span>
              </div>
              <div className="card-body">
                <BacktestBars forecast={analysis.forecast} />
              </div>
            </section>
          </div>

          <section className="card report-card" aria-labelledby="report-s6">
            <div className="card-head">
              <span className="card-head-label" id="report-s6">6 · Unusual months (|robust z| ≥ 3.5)</span>
              <span className="card-head-meta">{anomalies.events.length} events</span>
            </div>
            <div className="card-body">
              {anomalies.events.length === 0 ? (
                <p className="report-empty">No statistically unusual months flagged in this record.</p>
              ) : (
                <div className="anomaly-bars">
                  {anomalies.events.slice(0, 12).map((ev) => {
                    const width = Math.min(100, (Math.abs(ev.zScore) / maxAnomalyZ) * 100);
                    return (
                      <div key={`${ev.index}-${ev.monthLabel}`} className="anomaly-bar-row">
                        <span className="anomaly-bar-label">{ev.monthLabel}</span>
                        <div className="anomaly-bar-track" aria-hidden="true">
                          <span className="anomaly-bar-fill" style={{ width: `${width.toFixed(1)}%` }} />
                          <span className="anomaly-bar-threshold" style={{ left: `${((3.5 / maxAnomalyZ) * 100).toFixed(1)}%` }} />
                        </div>
                        <span className="anomaly-bar-value">
                          {formatSignedNumber(ev.departure)} {ev.unit} · z = {formatSignedNumber(ev.zScore)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="anomaly-caution">{anomalies.cautionNote}</p>
            </div>
          </section>

          <section className="card report-card" aria-labelledby="report-s7">
            <div className="card-head">
              <span className="card-head-label" id="report-s7">7 · How to read this honestly</span>
            </div>
            <div className="card-body report-honesty">
              <ul>
                <li>Trends are associations in the record, not causal attribution to human activity.</li>
                <li>Every number here was computed by the backend (Theil–Sen slope, Mann–Kendall p-value, robust-z anomalies) — never by the LLM.</li>
                <li>{coverage?.synthetic_demo
                    ? "This view is demo/synthetic in part — check the badge above."
                    : "The record is real NASA POWER satellite+model data; NDVI/SST/sea level are intentionally absent, never faked."}</li>
                <li>The forecast ribbon is a probabilistic outlook; p10–p90 bands widen with horizon — verify the backtest (Section 5) before acting.</li>
                <li>Cross-region comparisons need the same dataset resolution — climate twins are hypotheses, not classifications.</li>
              </ul>
              <p className="report-coda">
                Want the full reproducible dossier with citations and evidence export?{" "}
                <Link to={`/region/${region.slug}/notebook`}>Open the Notebook →</Link>
              </p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
