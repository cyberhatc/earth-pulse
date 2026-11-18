import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ContextChipBar } from "../components/ContextChipBar";
import { PointDossier } from "../components/PointDossier";
import { TopBar } from "../components/TopBar";
import { TrendChart } from "../components/TrendChart";
import { useInvestigation } from "../lib/context";
import { getVariable } from "../lib/data";
import { buildInvestigationMarkdown } from "../lib/intelligence";
import {
  formatCoords,
  formatP,
  formatSignedNumber,
  formatSlope,
} from "../lib/trend";
import { useRegionRoute } from "../lib/useRegionRoute";

export function RegionNotebookPage() {
  const { region } = useRegionRoute();
  const { point, setPoint, messages, cards, live } = useInvestigation();
  const [searchParams] = useSearchParams();
  const [copied, setCopied] = useState(false);

  const initialQuestion = useMemo(() => {
    const fromUrl = searchParams.get("q");
    if (fromUrl) return fromUrl;
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    return lastUser?.text ?? region?.teaser ?? "";
  }, [searchParams, messages, region?.teaser]);

  const [researchQuestion, setResearchQuestion] = useState(initialQuestion);

  useEffect(() => {
    setResearchQuestion(initialQuestion);
  }, [initialQuestion]);

  useEffect(() => {
    const ptParam = searchParams.get("pt");
    if (!ptParam) return;
    const parts = ptParam.split(",").map(Number);
    if (
      parts.length === 2 &&
      Number.isFinite(parts[0]) &&
      Number.isFinite(parts[1])
    ) {
      setPoint([parts[0], parts[1]]);
    }
  }, [searchParams, setPoint]);

  const bundle = useMemo(() => {
    if (!region || !live.analysis) return null;
    const variable = getVariable(region.variable);
    const analysis = live.analysis;
    return {
      variable,
      series: analysis.series,
      stats: analysis.stats,
      fingerprint: analysis.fingerprint,
      anomalies: analysis.anomalyReport,
      evidence: analysis.evidence,
      analysis,
    };
  }, [region, live.analysis]);

  if (!region || !bundle) {
    return (
      <div className="workspace-page">
        <TopBar backHref="/regions" backLabel="Regions" />
      </div>
    );
  }

  const { variable, series, stats, fingerprint, anomalies, evidence, analysis } = bundle;

  const buildShareUrl = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("q", researchQuestion || region.teaser);
    if (point) {
      url.searchParams.set(
        "pt",
        `${point[0].toFixed(3)},${point[1].toFixed(3)}`,
      );
    } else {
      url.searchParams.delete("pt");
    }
    return url.toString();
  };

  const handleCopyLink = async () => {
    const url = buildShareUrl();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleDownloadMarkdown = () => {
    const md = buildInvestigationMarkdown({
      region,
      point,
      researchQuestion,
      stats,
      fingerprint,
      anomalies,
      evidence,
      shareUrl: buildShareUrl(),
      period: analysis.period,
      dataStatus: analysis.isLive
        ? `Live backend · ${analysis.sourceLabel} · ${analysis.sourceNote}`
        : `${analysis.status} · ${analysis.sourceNote}`,
    });
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `case-file-${region.slug}.md`;
    a.click();
    URL.revokeObjectURL(href);
  };

  const handleDownloadJson = () => {
    const payload = {
      caseFile: region.slug,
      researchQuestion,
      region,
      selectedPoint: point,
      dataStatus: {
        live: analysis.isLive,
        status: analysis.status,
        source: analysis.sourceLabel,
        note: analysis.sourceNote,
        backend_model: analysis.forecast?.model ?? null,
        llm_generator: analysis.explanation?.generator ?? null,
        llm_model: analysis.explanation?.model ?? null,
      },
      stats,
      fingerprint,
      anomalies,
      evidence,
      generatedCardsCount: cards.length,
      reproduceUrl: buildShareUrl(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `case-file-${region.slug}.json`;
    a.click();
    URL.revokeObjectURL(href);
  };

  return (
    <div className="workspace-page">
      <TopBar backHref={`/region/${region.slug}`} backLabel={region.name} />
      <ContextChipBar mode="notebook" />
      <main className="notebook-page">
        <div className="shell">
          <div className="notebook-head">
            <div>
              <p className="eyebrow">
                {region.plate} · REPRODUCIBLE CASE DOSSIER · {region.bboxLabel}
              </p>
              <h1 className="notebook-title">Case File: {region.name}</h1>
              <p className="notebook-sub">
                {variable.name} · {analysis.period[0]}–{analysis.period[1]} ·{" "}
                {cards.length} artifact card{cards.length === 1 ? "" : "s"} in
                session
              </p>
            </div>
            <div className="notebook-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => void handleCopyLink()}
              >
                {copied ? "Reproducible link copied ✓" : "Copy reproducible link"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleDownloadJson}
              >
                Export JSON
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleDownloadMarkdown}
              >
                Download Case File (.md) ↓
              </button>
            </div>
          </div>

          <div className="notebook-grid">
            <section className="card">
              <div className="card-head">
                <span className="card-head-label">1. Research Question</span>
              </div>
              <div className="card-body">
                <label htmlFor="notebook-question" className="sr-only">
                  Research question
                </label>
                <input
                  id="notebook-question"
                  type="text"
                  className="notebook-question-input"
                  value={researchQuestion}
                  onChange={(e) => setResearchQuestion(e.target.value)}
                  placeholder="Enter the research question for this case file…"
                />
              </div>
            </section>

            <section className="card">
              <div className="card-head">
                <span className="card-head-label">
                  2. Selected Territory, Bounding Box &amp; Variables
                </span>
              </div>
              <div className="card-body">
                <dl className="evidence-grid">
                  <div>
                    <dt>TERRITORY &amp; BOUNDS</dt>
                    <dd>
                      {region.name} ({region.bboxLabel} · {region.climate})
                    </dd>
                  </div>
                  <div>
                    <dt>PINNED COORDINATE</dt>
                    <dd>
                      {point
                        ? formatCoords(point[0], point[1], 2)
                        : "Regional composite (no point pinned)"}
                    </dd>
                  </div>
                  <div>
                    <dt>PRIMARY DATASET</dt>
                    <dd>
                      {evidence.dataset} ({evidence.source})
                    </dd>
                  </div>
                  <div>
                    <dt>ANALYSIS METHODS</dt>
                    <dd>
                      Backend Theil–Sen slope + Mann–Kendall significance +
                      12-month detrended anomaly z-score + multi-variable
                      fingerprint. The local LLM only narrates the numbers.
                    </dd>
                  </div>
                  <div>
                    <dt>DATA STATUS</dt>
                    <dd>
                      {analysis.isLive
                        ? `Live backend · ${analysis.sourceLabel}`
                        : analysis.status === "partial"
                          ? "Backend reachable; case-file variable missing — demo fallback shown."
                          : "Backend offline / loading — local demo series shown."}
                    </dd>
                  </div>
                </dl>
              </div>
            </section>

            <section className="card">
              <div className="card-head">
                <span className="card-head-label">
                  3. Charts &amp; Coupled Results
                </span>
                <span className="card-head-meta">{formatSlope(stats)}</span>
              </div>
              <div className="card-body">
                <TrendChart
                  series={series}
                  period={analysis.period}
                  slopePerDecade={stats.slope}
                  unit={variable.unit}
                  significant={stats.significant}
                  direction={stats.direction}
                />
                <div className="notebook-fp-summary">
                  <p className="fp-synthesis-copy">
                    {fingerprint.coupledInsight}
                  </p>
                  <div className="notebook-fp-lines">
                    {fingerprint.dimensions.map((d) => (
                      <div key={d.key} className="notebook-fp-item">
                        <span className="notebook-fp-label">{d.shortLabel}</span>
                        <span className="notebook-fp-val">
                          {formatSignedNumber(d.slope)} {d.slopeUnit} ({formatP(d.pValue)})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="card">
              <div className="card-head">
                <span className="card-head-label">
                  4. Evidence, Anomalies &amp; Limitations
                </span>
                <span className="card-head-meta">
                  {evidence.confidenceLevel} confidence
                </span>
              </div>
              <div className="card-body">
                <p className="anomaly-summary">{anomalies.summary}</p>
                <p className="anomaly-caution">{anomalies.cautionNote}</p>
                <div className="notebook-evidence-wrap">
                  <dl className="evidence-grid">
                    <div>
                      <dt>RESOLUTION</dt>
                      <dd>{evidence.spatialResolution}</dd>
                    </div>
                    <div>
                      <dt>MISSING DATA</dt>
                      <dd>{evidence.missingData}</dd>
                    </div>
                    <div>
                      <dt>SIGNIFICANCE</dt>
                      <dd>{evidence.statisticalSignificance}</dd>
                    </div>
                    <div>
                      <dt>LIMITATIONS</dt>
                      <dd>{evidence.limitations}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </section>
          </div>

          <PointDossier
            lat={(point ?? region.center)[0]}
            lon={(point ?? region.center)[1]}
            regionName={region.name}
            regionSlug={region.slug}
            pinned={Boolean(point)}
          />
        </div>
      </main>
    </div>
  );
}
