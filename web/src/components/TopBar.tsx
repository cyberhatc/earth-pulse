import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useInvestigation } from "../lib/context";
import {
  applyTheme,
  nextTheme,
  readCurrentTheme,
  type ThemeMode,
} from "../lib/theme";

type TopBarProps = {
  backHref?: string;
  backLabel?: string;
  showThemeToggle?: boolean;
};

export function TopBar({ backHref, backLabel, showThemeToggle = true }: TopBarProps) {
  const [theme, setTheme] = useState<ThemeMode>(() => readCurrentTheme());
  const { health, healthError, live, refreshLive } = useInvestigation();

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => {
      const updated = nextTheme(prev);
      applyTheme(updated);
      return updated;
    });
  };

  const isDark = theme === "dark";

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="topbar-left">
          <Link to="/" className="wordmark" aria-label="Earth System Trend Detective home">
            Earth System Trend Detective
          </Link>
          {backHref && backLabel ? (
            <>
              <span className="topbar-sep" aria-hidden="true">
                /
              </span>
              <Link to={backHref} className="topbar-back">
                ← {backLabel}
              </Link>
            </>
          ) : null}
        </div>
        <nav className="topbar-nav" aria-label="Primary navigation">
          <Link to="/regions" className="topbar-link">
            Case Files
          </Link>
          <Link to="/trend" className="topbar-link">
            Global Trend
          </Link>
          <a
            href="https://www.earthdata.nasa.gov/"
            target="_blank"
            rel="noopener noreferrer"
            className="topbar-link"
          >
            NASA Earthdata
          </a>
          <button
            type="button"
            className={`api-status api-${health ? "on" : "off"}`}
            onClick={refreshLive}
            title={
              health
                ? `Backend ${health.status} · LLM ${
                    health.llm?.available
                      ? `${health.llm.model} via ${health.llm.backend}`
                      : health.llm?.backend || "templated"
                  }${live.error ? ` · ${live.error}` : ""}`
                : healthError || "Backend offline"
            }
            aria-label="Backend status — click to retry"
          >
            <span
              className={`live-dot ${
                health ? "live-live" : "live-error"
              }`}
              aria-hidden="true"
            />
            {health ? (health.llm?.available ? "LIVE LLM" : "LIVE API") : "DEMO"}
          </button>
          {showThemeToggle ? (
            <button
              type="button"
              className="theme-toggle"
              onClick={handleToggleTheme}
              aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
              aria-pressed={isDark}
            >
              {isDark ? (
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2" />
                  <path d="M12 20v2" />
                  <path d="m4.93 4.93 1.41 1.41" />
                  <path d="m17.66 17.66 1.41 1.41" />
                  <path d="M2 12h2" />
                  <path d="M20 12h2" />
                  <path d="m6.34 17.66-1.41 1.41" />
                  <path d="m19.07 4.93-1.41 1.41" />
                </svg>
              ) : (
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                </svg>
              )}
              <span>{isDark ? "Light" : "Dark"}</span>
            </button>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
