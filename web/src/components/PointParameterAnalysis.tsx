import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  sendChat,
  type BackendDossier,
  type ChatReply,
  type ChatTurn,
  type DossierMove,
  type DossierTrend,
} from "../lib/api";
import { ForecastBand } from "./ForecastBand";
import { TrendChart } from "./TrendChart";

type Props = {
  data: BackendDossier;
  lat: number;
  lon: number;
  regionName: string;
  regionSlug: string;
};

type ParameterEntry = {
  key: string;
  label: string;
  unit: string;
  group: string;
  source: string;
  native: string;
  coverage: string;
  n: number;
  first?: string | null;
  last?: string | null;
  trend?: DossierTrend;
  move?: DossierMove;
  backtest?: {
    mae: number;
    rmse: number;
    picp_p10_p90: number;
    skill_vs_persistence: number | null;
  };
  forecast?: { mean: number[]; lower: number[]; upper: number[] };
};

function formatNumber(v: number | undefined | null, digits = 3): string {
  if (v === undefined || v === null || !Number.isFinite(v)) return "—";
  return Math.abs(v) >= 100 ? v.toFixed(1) : v.toFixed(digits);
}

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

const QUICK_QUESTIONS = [
  "What is the observed trend?",
  "Is this trend statistically significant?",
  "What does the forecast show?",
  "Where does this data come from, and how reliable is it?",
];

export function PointParameterAnalysis({
  data,
  lat,
  lon,
  regionName,
  regionSlug,
}: Props) {
  const entries = useMemo<ParameterEntry[]>(() => {
    const groups = data.parameter_groups?.length
      ? data.parameter_groups
      : [
          {
            name: "Parameters",
            parameters: Object.values(data.parameters ?? {}),
          },
        ];
    const seen = new Set<string>();
    const out: ParameterEntry[] = [];
    const dates = data.history?.dates ?? [];
    for (const group of groups) {
      for (const meta of group.parameters ?? []) {
        const key = meta.key ?? "";
        if (!key || seen.has(key)) continue;
        seen.add(key);
        const cm = data.coverage?.parameter_meta?.[key] ?? meta;
        const raw = data.history?.series?.[key] ?? [];
        const finite = raw.filter(
          (v): v is number => typeof v === "number" && Number.isFinite(v),
        );
        out.push({
          key,
          label: meta.label || data.parameters?.[key]?.label || key,
          unit: meta.unit || data.parameters?.[key]?.unit || "",
          group: meta.group || group.name,
          source: meta.source || data.parameters?.[key]?.source || "—",
          native: meta.native || data.parameters?.[key]?.native || "—",
          coverage: meta.coverage || data.parameters?.[key]?.coverage || "—",
          n: cm.n ?? data.trends?.[key]?.n ?? finite.length,
          first: cm.first ?? null,
          last: cm.last ?? null,
          trend: data.trends?.[key],
          move: data.next_move?.[key],
          backtest: data.ml?.backtest?.per_parameter?.[key],
          forecast: data.forecast?.timeseries?.[key],
        });
      }
    }
    if (out.length === 0) {
      for (const [key, meta] of Object.entries(data.parameters ?? {})) {
        out.push({
          key,
          label: meta.label || key,
          unit: meta.unit || "",
          group: meta.group || "Parameters",
          source: meta.source || "—",
          native: meta.native || "—",
          coverage: meta.coverage || "—",
          n: data.trends?.[key]?.n ?? 0,
          trend: data.trends?.[key],
          move: data.next_move?.[key],
          backtest: data.ml?.backtest?.per_parameter?.[key],
          forecast: data.forecast?.timeseries?.[key],
        });
      }
    }
    void dates;
    return out;
  }, [data]);

  const byKey = useMemo(
    () => new Map(entries.map((entry) => [entry.key, entry])),
    [entries],
  );
  const analysed = useMemo(
    () => entries.filter((entry) => entry.n >= 12 && entry.trend),
    [entries],
  );

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showAllChats, setShowAllChats] = useState(false);
  const [threads, setThreads] = useState<Record<string, ChatTurn[]>>({});
  const [replies, setReplies] = useState<Record<string, ChatReply>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyParams, setBusyParams] = useState<Record<string, boolean>>({});
  const [askAllProgress, setAskAllProgress] = useState<{ done: number; total: number } | null>(null);
  const threadsRef = useRef(threads);
  const cancelRef = useRef(false);

  useEffect(() => {
    threadsRef.current = threads;
  }, [threads]);

  useEffect(() => {
    if (selectedKey && byKey.has(selectedKey)) return;
    const preferred = ["temperature", "precipitation", "ndvi", "lst_day"]
      .find((key) => byKey.has(key) && (byKey.get(key)?.n ?? 0) >= 12);
    setSelectedKey(preferred ?? analysed[0]?.key ?? entries[0]?.key ?? null);
  }, [entries, byKey, analysed, selectedKey]);

  const selected = selectedKey ? byKey.get(selectedKey) : undefined;

  const chart = useMemo(() => {
    if (!selected) return null;
    const raw = data.history?.series?.[selected.key] ?? [];
    const values = sanitize(raw);
    if (!values) return null;
    const dates = data.history?.dates ?? [];
    return {
      values,
      period: [
        Number((dates[0] ?? "1981-01").slice(0, 4)),
        Number((dates[dates.length - 1] ?? "2026-01").slice(0, 4)),
      ] as [number, number],
    };
  }, [data, selected]);

  const stats = useMemo(() => {
    if (!chart) return null;
    const values = chart.values.filter(Number.isFinite);
    if (!values.length) return null;
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    for (const v of values) {
      min = Math.min(min, v);
      max = Math.max(max, v);
      sum += v;
    }
    return {
      latest: values[values.length - 1],
      min,
      max,
      mean: sum / values.length,
    };
  }, [chart]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (entry) =>
        entry.label.toLowerCase().includes(q) ||
        entry.key.toLowerCase().includes(q) ||
        entry.group.toLowerCase().includes(q) ||
        entry.source.toLowerCase().includes(q),
    );
  }, [entries, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, ParameterEntry[]>();
    for (const entry of filtered) {
      const arr = map.get(entry.group) ?? [];
      arr.push(entry);
      map.set(entry.group, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const ask = async (key: string, question: string): Promise<void> => {
    const entry = byKey.get(key);
    const label = entry?.label ?? key;
    const prompt =
      `For ${label} (${key}) at ${regionName} (${lat.toFixed(3)}, ${lon.toFixed(3)}), ` +
      question;
    const history: ChatTurn[] = [
      ...(threadsRef.current[key] ?? []).slice(-10),
      { role: "user", content: prompt },
    ];
    setThreads((prev) => ({ ...prev, [key]: history }));
    setBusyParams((prev) => ({ ...prev, [key]: true }));
    try {
      const reply = await sendChat({
        lat,
        lon,
        messages: history,
        regionName,
        regionSlug,
        variable: key,
      });
      setReplies((prev) => ({ ...prev, [key]: reply }));
      setThreads((prev) => ({
        ...prev,
        [key]: [
          ...(prev[key] ?? history),
          { role: "assistant", content: reply.text },
        ],
      }));
    } catch (err) {
      const message = `Chat unavailable for ${label}: ${(err as Error)?.message ?? "request failed"}`;
      setReplies((prev) => ({
        ...prev,
        [key]: {
          text: message,
          generator: "error",
          model: null,
          confidence: "low",
          card_kind: "finding",
          llm_available: false,
        },
      }));
      setThreads((prev) => ({
        ...prev,
        [key]: [...(prev[key] ?? history), { role: "assistant", content: message }],
      }));
    } finally {
      setBusyParams((prev) => ({ ...prev, [key]: false }));
    }
  };

  const askAll = async () => {
    const targets = analysed.length ? analysed : entries;
    if (!targets.length) return;
    cancelRef.current = false;
    setAskAllProgress({ done: 0, total: targets.length });
    for (let i = 0; i < targets.length; i += 1) {
      if (cancelRef.current) break;
      const entry = targets[i];
      setSelectedKey(entry.key);
      await ask(
        entry.key,
        "summarise the observed trend, whether it is statistically significant, the forecast change and the data source in two sentences.",
      );
      setAskAllProgress({ done: i + 1, total: targets.length });
    }
    setAskAllProgress(null);
  };

  const submit = (event: FormEvent, key: string) => {
    event.preventDefault();
    const text = (drafts[key] ?? "").trim();
    if (!text || busyParams[key]) return;
    setDrafts((prev) => ({ ...prev, [key]: "" }));
    void ask(key, text);
  };

  const chatKeys = Object.keys(threads).filter((key) => (threads[key] ?? []).length > 0);

  return (
    <article className="dossier-card pa-root" id="parameter-analysis">
      <header className="dossier-card-head">
        <h3>Per-parameter analysis &amp; chat</h3>
        <span>
          10 × 10 km box · real point data · {analysed.length} of {entries.length} parameters
          have usable series
        </span>
      </header>

      <div className="pa-toolbar">
        <label className="pa-search">
          <span className="sr-only">Find a parameter</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find parameter, e.g. NDVI, NO₂, soil moisture…"
          />
        </label>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => void askAll()}
          disabled={analysed.length === 0 || askAllProgress !== null}
        >
          {askAllProgress
            ? `Analysing ${askAllProgress.done}/${askAllProgress.total}…`
            : "Ask every parameter"}
        </button>
        {askAllProgress && (
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              cancelRef.current = true;
            }}
          >
            Stop
          </button>
        )}
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setShowAllChats((v) => !v)}
        >
          {showAllChats ? "Hide chats" : `All parameter chats (${chatKeys.length})`}
        </button>
      </div>

      {askAllProgress && (
        <div className="pa-progress" aria-live="polite">
          <div
            className="pa-progress-fill"
            style={{
              width: `${Math.round((askAllProgress.done / Math.max(1, askAllProgress.total)) * 100)}%`,
            }}
          />
        </div>
      )}

      <div className="pa-layout">
        <div className="pa-list" aria-label="Parameters">
          {grouped.length === 0 && (
            <p className="dossier-copy">No parameters match “{query}”.</p>
          )}
          {grouped.map(([group, items]) => (
            <div key={group} className="pa-group">
              <div className="pa-group-title">{group}</div>
              {items.map((entry) => {
                const active = entry.key === selectedKey;
                const count = (threads[entry.key] ?? []).filter(
                  (turn) => turn.role === "user",
                ).length;
                return (
                  <button
                    type="button"
                    key={entry.key}
                    className={`pa-item ${active ? "is-active" : ""}`}
                    onClick={() => setSelectedKey(entry.key)}
                  >
                    <span className="pa-item-main">
                      <strong>{entry.label}</strong>
                      <small>{entry.source}</small>
                    </span>
                    <span className="pa-item-meta">
                      <span>
                        {entry.trend && entry.n >= 12
                          ? `${entry.trend.slope_per_decade >= 0 ? "+" : "−"}${formatNumber(
                              Math.abs(entry.trend.slope_per_decade),
                            )} ${entry.unit}/dec`
                          : "no series"}
                      </span>
                      <small>
                        n={entry.n}
                        {count ? ` · ${count} chat${count === 1 ? "" : "s"}` : ""}
                      </small>
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {selected ? (
          <div className="pa-detail">
            <div className="pa-detail-head">
              <div>
                <p className="eyebrow">{selected.group}</p>
                <h4>{selected.label}</h4>
                <p className="pa-key">
                  {selected.key} · {selected.unit || "index"} · {selected.source}
                </p>
              </div>
              <span className="dossier-badge is-live">REAL POINT DATA</span>
            </div>

            <div className="pa-stat-grid">
              <div>
                <dt>Trend / decade</dt>
                <dd>
                  {selected.trend && selected.n >= 12
                    ? `${selected.trend.slope_per_decade >= 0 ? "+" : "−"}${formatNumber(
                        Math.abs(selected.trend.slope_per_decade),
                      )} ${selected.unit}`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt>Mann–Kendall p</dt>
                <dd>{formatNumber(selected.trend?.p_value, 4)}</dd>
              </div>
              <div>
                <dt>Significant</dt>
                <dd>{selected.trend?.significant ? "yes (α=0.05)" : "no"}</dd>
              </div>
              <div>
                <dt>Usable months</dt>
                <dd>{selected.n}</dd>
              </div>
              <div>
                <dt>Latest value</dt>
                <dd>{formatNumber(stats?.latest)}</dd>
              </div>
              <div>
                <dt>Observed range</dt>
                <dd>
                  {formatNumber(stats?.min)} – {formatNumber(stats?.max)}
                </dd>
              </div>
              <div>
                <dt>60-month change</dt>
                <dd>
                  {selected.move
                    ? `${selected.move.delta_over_horizon >= 0 ? "+" : "−"}${formatNumber(
                        Math.abs(selected.move.delta_over_horizon),
                      )} ${selected.unit}`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt>Backtest MAE</dt>
                <dd>{formatNumber(selected.backtest?.mae)}</dd>
              </div>
            </div>

            <div className="pa-provenance">
              <span>
                <strong>Record:</strong> {selected.first ?? data.coverage?.time_range?.[0] ?? "—"} →{" "}
                {selected.last ?? data.coverage?.time_range?.[1] ?? "—"}
              </span>
              <span>
                <strong>Native:</strong> {selected.native}
              </span>
              <span>
                <strong>Coverage:</strong> {selected.coverage}
              </span>
              <span>
                <strong>Area:</strong> nominal 10 × 10 km; {data.area?.resolution_note ?? ""}
              </span>
            </div>

            {chart && selected.trend ? (
              <div className="pa-chart">
                <h5>
                  Observed monthly record{" "}
                  <span>
                    {chart.period[0]}–{chart.period[1]} · {selected.unit}
                  </span>
                </h5>
                <TrendChart
                  series={chart.values}
                  period={chart.period}
                  slopePerDecade={selected.trend.slope_per_decade}
                  unit={selected.unit}
                  significant={selected.trend.significant}
                  direction={
                    selected.trend.slope_per_decade > 0
                      ? "up"
                      : selected.trend.slope_per_decade < 0
                        ? "down"
                        : "flat"
                  }
                />
              </div>
            ) : (
              <p className="dossier-copy">
                This product is requested but unavailable as a real point series here —
                no values were invented.
              </p>
            )}

            {selected.forecast && (
              <div className="pa-chart">
                <h5>
                  Projected next {data.forecast.horizon_months} months{" "}
                  <span>p10–p90 band · not an observation</span>
                </h5>
                <ForecastBand
                  dates={data.forecast.dates}
                  mean={selected.forecast.mean}
                  lower={selected.forecast.lower}
                  upper={selected.forecast.upper}
                  unit={selected.unit}
                />
              </div>
            )}

            {selected.backtest && (
              <p className="pa-backtest">
                Rolling backtest: MAE {formatNumber(selected.backtest.mae)}, RMSE{" "}
                {formatNumber(selected.backtest.rmse)}, p10–p90 coverage{" "}
                {formatNumber(selected.backtest.picp_p10_p90, 2)}, skill vs persistence{" "}
                {selected.backtest.skill_vs_persistence === null
                  ? "—"
                  : formatNumber(selected.backtest.skill_vs_persistence, 2)}
                .
              </p>
            )}

            <div className="pa-chat">
              <div className="pa-chat-head">
                <strong>Chat about {selected.label}</strong>
                <span>
                  {replies[selected.key]
                    ? `${replies[selected.key].generator} · ${replies[selected.key].confidence}`
                    : "grounded in this point store"}
                </span>
              </div>
              <div className="pa-chat-log" aria-live="polite">
                {(threads[selected.key] ?? []).length === 0 ? (
                  <p className="dossier-copy">
                    Ask only about the real {selected.label} record at {lat.toFixed(3)}°,
                    {lon.toFixed(3)}°. Answers use this point store, not generic climate facts.
                  </p>
                ) : (
                  (threads[selected.key] ?? []).map((turn, i) => (
                    <div key={`${selected.key}-${i}`} className={`pa-bubble is-${turn.role}`}>
                      <span>{turn.role === "user" ? "You" : "Earth Pulse"}</span>
                      <p>{turn.content}</p>
                    </div>
                  ))
                )}
                {busyParams[selected.key] && (
                  <p className="pa-typing">Reading the point record…</p>
                )}
              </div>
              <div className="pa-quick">
                {QUICK_QUESTIONS.map((question) => (
                  <button
                    type="button"
                    key={question}
                    onClick={() => void ask(selected.key, question)}
                    disabled={busyParams[selected.key]}
                  >
                    {question}
                  </button>
                ))}
              </div>
              <form className="pa-compose" onSubmit={(e) => submit(e, selected.key)}>
                <label className="sr-only" htmlFor={`pa-input-${selected.key}`}>
                  Ask about {selected.label}
                </label>
                <input
                  id={`pa-input-${selected.key}`}
                  value={drafts[selected.key] ?? ""}
                  onChange={(e) =>
                    setDrafts((prev) => ({ ...prev, [selected.key]: e.target.value }))
                  }
                  placeholder={`Ask about ${selected.label} at this point…`}
                />
                <button type="submit" className="btn-primary" disabled={busyParams[selected.key]}>
                  Send
                </button>
              </form>
              {replies[selected.key]?.guard_reason && (
                <p className="pa-guard">
                  Fact guard applied: {replies[selected.key].guard_reason}. Numbers come only
                  from the local point analysis.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="pa-detail pa-empty">Select a parameter to inspect its analysis.</div>
        )}
      </div>

      {showAllChats && (
        <div className="pa-all-chats">
          <h4>All parameter chats</h4>
          {chatKeys.length === 0 ? (
            <p className="dossier-copy">
              No parameter chats yet. Use “Ask every parameter” or chat with a single
              parameter above.
            </p>
          ) : (
            chatKeys.map((key) => {
              const thread = threads[key] ?? [];
              const lastUser = [...thread].reverse().find((t) => t.role === "user");
              const lastAssistant = [...thread].reverse().find((t) => t.role === "assistant");
              const reply = replies[key];
              return (
                <details key={key} className="pa-chat-thread">
                  <summary>
                    <strong>{byKey.get(key)?.label ?? key}</strong>
                    <span>{lastUser?.content ?? ""}</span>
                    <small>{reply ? `${reply.generator} · ${reply.confidence}` : "—"}</small>
                  </summary>
                  <p className="pa-latest">{lastAssistant?.content ?? "No answer yet."}</p>
                  <div className="pa-thread-log">
                    {thread.map((turn, i) => (
                      <p key={i}>
                        <strong>{turn.role === "user" ? "You" : "Earth Pulse"}:</strong>{" "}
                        {turn.content}
                      </p>
                    ))}
                  </div>
                </details>
              );
            })
          )}
        </div>
      )}
    </article>
  );
}
