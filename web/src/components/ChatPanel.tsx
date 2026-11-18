"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { SUGGESTIONS, generateReply } from "../lib/chat";
import { fetchDossier, sendChat, type BackendDossier, type ChatTurn } from "../lib/api";
import { useInvestigation } from "../lib/context";
import { getVariable } from "../lib/data";
import { computeStats, generateSeries } from "../lib/trend";
import type { CardKind } from "../lib/types";

const SPACE_URL = "https://devildead-earth-pulse-ai.static.hf.space/";

const KNOWN_CARD_KINDS: CardKind[] = [
  "finding",
  "trend-chart",
  "slope-map",
  "variable",
  "caveat",
  "fingerprint",
  "anomaly",
  "earth-twins",
  "story",
  "evidence",
  "forecast",
  "opposite",
  "coverage",
];

function asCardKind(value: string | undefined): CardKind {
  return KNOWN_CARD_KINDS.includes(value as CardKind)
    ? (value as CardKind)
    : "finding";
}

function guardNote(reason: string): string {
  switch (reason) {
    case "certainty_claim":
      return "The model's draft turned a p-value into a certainty claim, so fact-locked deterministic prose was substituted.";
    case "p_value_misuse":
      return "The model's draft treated a p-value as a probability or confidence level, so fact-locked deterministic prose was substituted.";
    case "band_misuse":
      return "The model's draft described the p10–p90 interval as a 10–90% chance, so fact-locked deterministic prose was substituted.";
    case "significance_misread":
      return "The model's draft called a non-significant trend statistically significant, so fact-locked deterministic prose was substituted.";
    default:
      return "The model's draft mentioned a number not present in the backend facts, so fact-locked deterministic prose was substituted.";
  }
}

export function ChatPanel() {
  const {
    region,
    point,
    messages,
    pendingPrompt,
    live,
    health,
    healthError,
    refreshLive,
    setPendingPrompt,
    addCard,
    addMessage,
  } = useInvestigation();

  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [pointParamsOpen, setPointParamsOpen] = useState(false);
  const [pointDossier, setPointDossier] = useState<BackendDossier | null>(null);
  const [pointParamsBusy, setPointParamsBusy] = useState(false);
  const [pointParamQuery, setPointParamQuery] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lastConsumedPromptRef = useRef<string | null>(null);

  const handleSend = useCallback(
    async (text: string, focusParam?: string) => {
      const trimmed = text.trim();
      if (!trimmed || !region) return;

      addMessage({ role: "user", text: trimmed });
      setDraft("");
      setBusy(true);

      const target = point ?? region.center;
      const variable = getVariable(region.variable);
      const history: ChatTurn[] = [
        ...messages
          .filter((message) => message.text.trim())
          .slice(-8)
          .map((message) => ({
            role: message.role,
            content: message.text,
          })),
        { role: "user", content: trimmed },
      ];

      try {
        const reply = await sendChat({
          lat: target[0],
          lon: target[1],
          messages: history,
          regionName: region.name,
          regionSlug: region.slug,
          variable: focusParam ?? variable.name,
        });
        const cardKind = asCardKind(reply.card_kind);
        const card = addCard({
          kind: cardKind,
          point: point ?? undefined,
        });
        addMessage({
          role: "assistant",
          text: reply.text,
          cardKind,
          cardId: card.id,
          generator: reply.generator,
          model: reply.model,
          confidence: reply.confidence,
          guardReason: reply.guard_reason ?? null,
          sources: reply.sources ?? [],
        });
      } catch (error) {
        // Backend or LLM unavailable: keep the investigation usable with the
        // deterministic local engine and say so explicitly.
        const series = live.analysis?.series ?? generateSeries(region);
        const stats = live.analysis?.stats ?? computeStats(region, series);
        const reply = generateReply(trimmed, region, stats);
        const card = addCard({
          kind: reply.cardKind,
          point: point ?? undefined,
        });
        addMessage({
          role: "assistant",
          text:
            reply.text +
            "\n\nNote: the backend chat endpoint was unreachable, so this reply uses the frontend's local demonstration engine — not live NASA data.",
          cardKind: reply.cardKind,
          cardId: card.id,
          generator: "local-demo",
          model: null,
          confidence: "low",
          sources: [],
        });
        console.warn("Earth Pulse backend chat failed:", error);
      } finally {
        setBusy(false);
      }
    },
    [region, point, messages, live.analysis, addCard, addMessage],
  );

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, busy]);

  useEffect(() => {
    if (region && pendingPrompt) {
      const text = pendingPrompt;
      if (lastConsumedPromptRef.current === text) {
        return;
      }
      lastConsumedPromptRef.current = text;
      setPendingPrompt(null);
      void handleSend(text);
    } else if (!pendingPrompt) {
      lastConsumedPromptRef.current = null;
    }
  }, [region, pendingPrompt, setPendingPrompt, handleSend]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!busy) {
        void handleSend(draft);
      }
    }
  };

  const quickSuggestions = SUGGESTIONS.slice(0, 4);

  const onDeviceUrl = useMemo(() => {
    if (!region) return null;
    const analysis = live.analysis;
    const target = point ?? region.center;
    const variable = getVariable(region.variable);
    const stats = analysis?.stats ?? computeStats(region, generateSeries(region));
    const coverage = analysis?.coverage ?? analysis?.payload?.data_coverage ?? null;
    const tr = coverage?.time_range ?? ["1981-01", "2026-11"];
    const synth = coverage ? coverage.synthetic_demo : true;
    const anomalies =
      analysis?.backendAnomalies?.length ??
      analysis?.payload?.past.anomalies.length ??
      0;

    let delta: number | null = null;
    const fc = analysis?.forecast;
    const pkey = analysis?.param ?? null;
    if (fc?.timeseries) {
      const key =
        pkey && fc.timeseries[pkey]
          ? pkey
          : Object.keys(fc.timeseries)[0];
      const mean = key ? fc.timeseries[key]?.mean : undefined;
      if (mean && mean.length > 1) {
        const k = Math.max(1, Math.min(12, Math.floor(mean.length / 2)));
        const head = mean.slice(0, k).reduce((a, b) => a + b, 0) / k;
        const tail = mean.slice(-k).reduce((a, b) => a + b, 0) / k;
        delta = tail - head;
      }
    }

    const params = new URLSearchParams({
      region: region.name,
      variable: variable.shortName,
      unit: variable.unit,
      slope: Number(stats.slope).toFixed(3),
      pvalue: Number(stats.pValue).toFixed(4),
      sig: stats.significant ? "true" : "false",
      direction: stats.direction,
      lat: Number(target[0]).toFixed(3),
      lon: Number(target[1]).toFixed(3),
      rec_start: tr[0],
      rec_end: tr[1],
      synth: synth ? "1" : "0",
      anomalies: String(anomalies),
      horizon: "60",
    });
    if (delta !== null) params.set("delta", delta.toFixed(3));
    return `${SPACE_URL}?${params.toString()}`;
  }, [region, point, live.analysis]);

  const loadPointDossier = useCallback(async () => {
    if (!region || pointDossier || pointParamsBusy) return;
    const target = point ?? region.center;
    setPointParamsBusy(true);
    try {
      const dossier = await fetchDossier(target[0], target[1], 60, region.slug);
      setPointDossier(dossier);
    } catch (error) {
      console.warn("Point dossier for parameter explorer failed:", error);
    } finally {
      setPointParamsBusy(false);
    }
  }, [region, point, pointDossier, pointParamsBusy]);

  const pointParams = useMemo(() => {
    const all = pointDossier?.parameter_groups?.flatMap((g) => g.parameters) ?? [];
    const q = pointParamQuery.trim().toLowerCase();
    const filtered = q
      ? all.filter(
          (p) =>
            p.label.toLowerCase().includes(q) ||
            (p.key ?? "").toLowerCase().includes(q) ||
            (p.group ?? "").toLowerCase().includes(q),
        )
      : all;
    return filtered.slice(0, 80);
  }, [pointDossier, pointParamQuery]);

  const askAboutParameter = (key: string, label: string) => {
    const target = point ?? region?.center;
    void handleSend(
      `Using only the real point data at ${target?.[0].toFixed(3)}°, ${target?.[1].toFixed(3)}°, explain the observed trend, significance, forecast and data source for ${label} (${key}).`,
      key,
    );
  };

  const notebookHref = region
    ? `/region/${region.slug}/notebook${
        point ? `?pt=${point[0].toFixed(4)},${point[1].toFixed(4)}` : ""
      }`
    : "/regions";

  return (
    <section className="chat-panel" aria-label="Investigation conversation">
      <div className="chat-engine-status">
        <span className={`live-dot live-${live.status}`} aria-hidden="true" />
        <span className="chat-engine-label">
          {live.status === "live"
            ? health?.rag?.enabled
              ? health.rag.backend === "hf-router"
                ? `Live backend · HF serverless RAG${
                    health.rag.model ? ` · ${health.rag.model.split("/").pop()}` : ""
                  }`
                : `Live backend · HF RAG Space${
                    health.rag.kb_chunks ? ` · ${health.rag.kb_chunks} sources indexed` : ""
                  }`
              : health?.llm?.available
                ? `Live backend · Ollama ${health.llm.model ?? ""}`
                : "Live backend · templated LLM"
            : live.status === "partial"
              ? "Live backend · partial coverage"
              : live.status === "error"
                ? "Backend offline · local demo engine"
                : "Connecting to backend…"}
        </span>
        {healthError || live.error ? (
          <button type="button" className="chat-retry" onClick={refreshLive}>
            Retry
          </button>
        ) : null}
        {onDeviceUrl ? (
          <a
            className="chat-ondevice-link"
            href={onDeviceUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Free on-device assistant — open in a new tab"
          >
            On-device AI ↗
          </a>
        ) : null}
      </div>

      <div className="chat-point-explorer">
        <div className="chat-point-explorer-head">
          <button
            type="button"
            className="chat-point-toggle"
            onClick={() => {
              setPointParamsOpen((v) => !v);
              if (!pointParamsOpen) void loadPointDossier();
            }}
            aria-expanded={pointParamsOpen}
          >
            <span aria-hidden="true">{pointParamsOpen ? "▾" : "▸"}</span>{" "}
            Point data · all parameters (10 km box)
          </button>
          <Link className="chat-point-notebook" to={notebookHref}>
            Full analysis ↗
          </Link>
        </div>
        {pointParamsOpen && (
          <div className="chat-point-body">
            <p className="chat-point-note">
              {pointDossier
                ? `Real point store at ${pointDossier.location.lat.toFixed(3)}°, ${pointDossier.location.lon.toFixed(3)}° · ${pointParams.length} parameters · click any parameter to ask about its own data.`
                : "Loading the real point catalogue for this coordinate…"}
            </p>
            {pointDossier && (
              <>
                <input
                  className="chat-point-search"
                  type="search"
                  value={pointParamQuery}
                  onChange={(e) => setPointParamQuery(e.target.value)}
                  placeholder="Filter parameters…"
                  aria-label="Filter point parameters"
                />
                <div className="chat-point-chips">
                  {pointParams.map((p) => (
                    <button
                      type="button"
                      key={p.key ?? p.label}
                      className="chat-param-chip"
                      disabled={busy}
                      title={`${p.source ?? ""} · ${p.unit ?? ""}`}
                      onClick={() => askAboutParameter(p.key ?? p.label, p.label)}
                    >
                      {p.label}
                      <span>
                        {(pointDossier.trends[p.key ?? ""]?.n ?? 0) >= 12
                          ? `${pointDossier.trends[p.key ?? ""].slope_per_decade >= 0 ? "+" : "−"}${Math.abs(
                              pointDossier.trends[p.key ?? ""].slope_per_decade,
                            ).toFixed(3)}`
                          : "no series"}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
            {pointParamsBusy && !pointDossier && (
              <p className="chat-point-note">Reading local point store…</p>
            )}
          </div>
        )}
      </div>

      <div className="chat-messages" ref={scrollRef}>
        {messages.length === 0 && region ? (
          <div className="chat-bubble chat-bubble-assistant">
            Hi — I&apos;m your trend assistant for {region.name}. Ask me
            anything: is it changing?, what does the forecast say?, where is the
            anomaly? Answers come from the backend&apos;s NASA data and models.
          </div>
        ) : null}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`chat-bubble ${
              msg.role === "user"
                ? "chat-bubble-user"
                : "chat-bubble-assistant"
            }`}
          >
            {msg.text}
            {msg.role === "assistant" && msg.generator ? (
              <>
                <span className="chat-bubble-meta">
                  {msg.generator}
                  {msg.model ? ` · ${msg.model}` : ""}
                  {msg.confidence ? ` · ${msg.confidence} confidence` : ""}
                </span>
                {msg.sources && msg.sources.length > 0 ? (
                  <span className="chat-sources">
                    Sources ·{" "}
                    {msg.sources.slice(0, 3).map((source) => (
                      <span
                        key={`${source.id ?? source.title}`}
                        className="chat-source-chip"
                        title={source.source ?? undefined}
                      >
                        {source.title}
                      </span>
                    ))}
                  </span>
                ) : null}
                {msg.guardReason ? (
                  <span className="chat-guard-note">
                    {guardNote(msg.guardReason)}
                  </span>
                ) : null}
              </>
            ) : null}
          </div>
        ))}

        {busy ? (
          <div className="chat-bubble chat-bubble-assistant chat-bubble-busy">
            {live.status === "live"
              ? health?.rag?.enabled
                ? "Consulting the HF RAG service…"
                : "Consulting the local model…"
              : "Analysing…"}
          </div>
        ) : null}
      </div>

      <div className="chat-suggestions" aria-label="Suggested questions">
        {quickSuggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            className="suggestion-chip"
            disabled={busy || !region}
            onClick={() => void handleSend(suggestion)}
          >
            {suggestion}
          </button>
        ))}
      </div>

      <form
        className="chat-composer"
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) {
            void handleSend(draft);
          }
        }}
      >
        <label htmlFor="chat-input" className="sr-only">
          Ask a question about {region?.name ?? "this region"}
        </label>
        <textarea
          id="chat-input"
          className="chat-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Ask about ${region?.name ?? "this region"}…`}
          rows={2}
        />
        <div className="chat-composer-foot">
          <span className="chat-hint">
            Enter to send · Shift+Enter for newline
          </span>
          <button
            type="submit"
            className="btn-primary"
            disabled={busy || !draft.trim() || !region}
          >
            Send ↑
          </button>
        </div>
      </form>
    </section>
  );
}
