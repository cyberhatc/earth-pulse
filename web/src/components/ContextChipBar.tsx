import { Link } from "react-router-dom";
import { useInvestigation } from "../lib/context";
import { getVariable } from "../lib/data";
import { formatCoords } from "../lib/trend";

type ContextChipBarProps = {
  mode: "hub" | "chat" | "map" | "notebook" | "videos" | "visualizations";
};

export function ContextChipBar({ mode }: ContextChipBarProps) {
  const { region, point, setPoint, live, health } = useInvestigation();

  if (!region) {
    return null;
  }

  const variable = getVariable(region.variable);
  const period = live.analysis?.period ?? region.period;
  const status = live.status;

  const tabs: Array<{ to: string; label: string; key: ContextChipBarProps["mode"] }> = [
    { to: `/region/${region.slug}`, label: "Overview", key: "hub" },
    { to: `/region/${region.slug}/visualizations`, label: "Visualizations", key: "visualizations" },
    { to: `/region/${region.slug}/chat`, label: "Chat", key: "chat" },
    { to: `/region/${region.slug}/videos`, label: "Videos", key: "videos" },
    { to: `/region/${region.slug}/map`, label: "Map", key: "map" },
    { to: `/region/${region.slug}/notebook`, label: "Notebook", key: "notebook" },
  ];

  return (
    <div className="chipbar" role="region" aria-label="Investigation context">
      <div className="chipbar-inner chipbar-inner-rich">
        <div className="chipbar-meta">
          <span className="meta-plate">{region.plate}</span>
          <span className="meta-sep" aria-hidden="true">·</span>
          <strong className="meta-region">{region.name}</strong>
          <span className="meta-sep" aria-hidden="true">·</span>
          <span>{variable.shortName}</span>
          <span className="meta-sep" aria-hidden="true">·</span>
          <span>{region.bboxLabel}</span>
          <span className="meta-sep" aria-hidden="true">·</span>
          <span>
            {period[0]}–{period[1]}
          </span>
          <span className="meta-sep" aria-hidden="true">·</span>
          <span
            className={`chip-status chip-status-${status}`}
            title={live.analysis?.sourceNote}
          >
            <span className={`live-dot live-${status}`} aria-hidden="true" />
            {status === "live"
              ? live.analysis?.isLive
                ? "LIVE BACKEND"
                : "LIVE · DEMO VAR"
              : status === "partial"
                ? "DEMO FALLBACK"
                : status === "error"
                  ? "BACKEND OFFLINE"
                  : "CONNECTING…"}
          </span>
          {health?.llm?.available ? <span className="chip-llm">{health.llm.model}</span> : null}
          {point ? (
            <>
              <span className="meta-sep" aria-hidden="true">·</span>
              <span className="meta-point">
                <span>Pin {formatCoords(point[0], point[1], 1)}</span>
                <button
                  type="button"
                  className="chip-clear"
                  onClick={() => setPoint(null)}
                  aria-label="Clear selected point"
                >
                  ×
                </button>
              </span>
            </>
          ) : null}
        </div>

        <nav className="segmented segmented-rich" aria-label="Location views">
          {tabs.map((tab) => (
            <Link
              key={tab.key}
              to={tab.to}
              className={mode === tab.key ? "seg active" : "seg"}
              aria-current={mode === tab.key ? "page" : undefined}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
