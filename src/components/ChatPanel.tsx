"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { SUGGESTIONS, generateReply } from "../lib/chat";
import { useInvestigation } from "../lib/context";
import { computeStats, generateSeries } from "../lib/trend";

export function ChatPanel() {
  const {
    region,
    point,
    messages,
    pendingPrompt,
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

      await new Promise((resolve) => setTimeout(resolve, 300));

      const series = generateSeries(region);
      const stats = computeStats(region, series);
      const reply = generateReply(trimmed, region, stats);
      const card = addCard({
        kind: reply.cardKind,
        point: point ?? undefined,
      });

      addMessage({
        role: "assistant",
        text: reply.text,
        cardKind: reply.cardKind,
        cardId: card.id,
      });
      setBusy(false);
    },
    [region, point, addCard, addMessage],
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

  return (
    <section className="chat-panel" aria-label="Investigation conversation">
      <div className="chat-messages" ref={scrollRef}>
        {messages.length === 0 && region ? (
          <div className="chat-bubble chat-bubble-assistant">
            Hi — I&apos;m your trend assistant for {region.name}. Ask me
            anything: is it changing?, where?, what does significant mean?
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
          </div>
        ))}

        {busy ? (
          <div className="chat-bubble chat-bubble-assistant chat-bubble-busy">
            Analysing…
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
