import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { TopBar } from "../components/TopBar";
import { useInvestigation } from "../lib/context";
import { getVariable } from "../lib/data";
import { computeStats, formatSlope, generateSeries } from "../lib/trend";
import { useRegionRoute } from "../lib/useRegionRoute";

export function RegionHubPage() {
  const { region } = useRegionRoute();
  const { setPendingPrompt } = useInvestigation();
  const navigate = useNavigate();

  const summary = useMemo(() => {
    if (!region) return null;
    const variable = getVariable(region.variable);
    const series = generateSeries(region);
    const stats = computeStats(region, series);
    return { variable, stats };
  }, [region]);

  if (!region || !summary) {
    return (
      <div className="page">
        <TopBar backHref="/regions" backLabel="All case files" />
      </div>
    );
  }

  const { variable, stats } = summary;
  const starterQuestions = [
    `Is ${variable.shortName.toLowerCase()} changing across ${region.name}?`,
    "What does 'significant' mean here?",
  ];

  const handleLaunchPrompt = (question: string) => {
    setPendingPrompt(question);
    navigate(`/region/${region.slug}/chat`);
  };

  return (
    <div className="page">
      <TopBar backHref="/regions" backLabel="All case files" />
      <main className="hub-page">
        <div className="shell">
          <p className="eyebrow">
            {region.plate} · {region.bboxLabel} · {region.area}
          </p>
          <h1 className="hub-title">{region.name}</h1>
          <p className="hub-sub">
            {variable.name} · {region.period[0]}–{region.period[1]} · Decadal trend{" "}
            {formatSlope(stats)} (
            {stats.significant ? "significant at α = 0.05" : "not significant"})
          </p>

          <div className="hub-modes">
            <Link to={`/region/${region.slug}/chat`} className="mode-card specimen-frame">
              <div className="mode-icon" aria-hidden="true">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <h2 className="mode-title">Interrogate in Chat</h2>
              <p className="mode-body">
                Ask plain-language questions about the coupled record. Findings,
                charts, fingerprints, anomalies, and evidence cards stack cleanly
                beside the dialogue.
              </p>
              <span className="mode-cta">Open conversation →</span>
            </Link>

            <Link to={`/region/${region.slug}/map`} className="mode-card specimen-frame">
              <div className="mode-icon" aria-hidden="true">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                  <line x1="8" y1="2" x2="8" y2="18" />
                  <line x1="16" y1="6" x2="16" y2="22" />
                </svg>
              </div>
              <h2 className="mode-title">Inspect Spatial Map</h2>
              <p className="mode-body">
                Explore the gridded bounding box ({region.bboxLabel}). Pin any
                coordinate across land or sea and carry it back into conversation.
              </p>
              <span className="mode-cta">Open analyst map →</span>
            </Link>
          </div>

          <section className="hub-tools" aria-label="Investigation modules">
            <button
              type="button"
              className="hub-tool-btn"
              onClick={() => handleLaunchPrompt("Show the trend fingerprint")}
            >
              <span className="hub-tool-tag">Module A</span>
              <span className="hub-tool-name">Earth Trend Fingerprint →</span>
            </button>
            <button
              type="button"
              className="hub-tool-btn"
              onClick={() =>
                handleLaunchPrompt("What changed unusually in this region?")
              }
            >
              <span className="hub-tool-tag">Module C</span>
              <span className="hub-tool-name">Earth Anomaly Detective →</span>
            </button>
            <button
              type="button"
              className="hub-tool-btn"
              onClick={() =>
                handleLaunchPrompt("Find Earth twins across continents")
              }
            >
              <span className="hub-tool-tag">Module E</span>
              <span className="hub-tool-name">Earth Twin Finder →</span>
            </button>
            <button
              type="button"
              className="hub-tool-btn"
              onClick={() =>
                handleLaunchPrompt("Tell the local story in Hindi / Kannada")
              }
            >
              <span className="hub-tool-tag">Module F</span>
              <span className="hub-tool-name">
                Local Stories (EN · हिन्दी · ಕನ್ನಡ) →
              </span>
            </button>
            <Link
              to={`/region/${region.slug}/notebook`}
              className="hub-tool-btn"
            >
              <span className="hub-tool-tag">Module D</span>
              <span className="hub-tool-name">Reproducible Notebook →</span>
            </Link>
          </section>

          <section className="starter-box" aria-label="Starter questions">
            <p className="starter-heading">Suggested opening queries</p>
            <div className="starter-list">
              {starterQuestions.map((question) => (
                <button
                  key={question}
                  type="button"
                  className="starter-link"
                  onClick={() => handleLaunchPrompt(question)}
                >
                  <span>{question}</span>
                  <span className="teaser-arrow" aria-hidden="true">
                    →
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
