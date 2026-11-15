"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { SUGGESTIONS, generateReply } from "../lib/chat";
import { sendChat, type ChatTurn } from "../lib/api";
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
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lastConsumedPromptRef = useRef<string | null>(null);

  const handleSend = useCallback(
    async (text: string) => {
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
          variable: variable.name,
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
        delta = mean[mean.length - 1] - mean[0];
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
