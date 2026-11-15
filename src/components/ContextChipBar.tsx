"use client";

import { Link } from "react-router-dom";
import { useInvestigation } from "../lib/context";
import { getVariable } from "../lib/data";
import { formatCoords } from "../lib/trend";

type ContextChipBarProps = {
  mode: "chat" | "map" | "notebook" | "hub";
};

export function ContextChipBar({ mode }: ContextChipBarProps) {
  const { region, point, setPoint } = useInvestigation();

  if (!region) {
    return null;
  }

  const variable = getVariable(region.variable);

  return (
    <div className="chipbar" role="region" aria-label="Investigation context">
      <div className="chipbar-inner">
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
            {region.period[0]}–{region.period[1]}
          </span>
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

        <nav className="segmented" aria-label="Investigation mode">
          <Link
            to={`/region/${region.slug}/chat`}
            className={mode === "chat" ? "seg active" : "seg"}
            aria-current={mode === "chat" ? "page" : undefined}
          >
            Chat
          </Link>
          <Link
            to={`/region/${region.slug}/map`}
            className={mode === "map" ? "seg active" : "seg"}
            aria-current={mode === "map" ? "page" : undefined}
          >
            Map
          </Link>
          <Link
            to={`/region/${region.slug}/notebook`}
            className={mode === "notebook" ? "seg active" : "seg"}
            aria-current={mode === "notebook" ? "page" : undefined}
          >
            Notebook
          </Link>
        </nav>
      </div>
    </div>
  );
}
