"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getRegion } from "./data";
import type { CanvasCard, ChatMessage, Region } from "./types";

const STORAGE_KEY = "etd.investigation.v1";

type PersistedState = {
  region: Region | null;
  point: [number, number] | null;
  cards: CanvasCard[];
  messages: ChatMessage[];
};

type InvestigationContextValue = {
  hydrated: boolean;
  region: Region | null;
  point: [number, number] | null;
  pendingPrompt: string | null;
  cards: CanvasCard[];
  messages: ChatMessage[];
  setRegion: (region: Region | null) => void;
  setPoint: (point: [number, number] | null) => void;
  setPendingPrompt: (prompt: string | null) => void;
  addCard: (input: Omit<CanvasCard, "id" | "createdAt">) => CanvasCard;
  addMessage: (input: Omit<ChatMessage, "id">) => ChatMessage;
  resetRegion: () => void;
};

const InvestigationContext = createContext<InvestigationContextValue | null>(
  null,
);

function createId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now()}-${rand}`;
}

export function InvestigationProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [region, setRegionState] = useState<Region | null>(null);
  const [point, setPointState] = useState<[number, number] | null>(null);
  const [pendingPrompt, setPendingPromptState] = useState<string | null>(null);
  const [cards, setCards] = useState<CanvasCard[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedState>;
        const matched = parsed.region ? getRegion(parsed.region.slug) : undefined;
        if (matched) {
          setRegionState(matched);
          if (
            Array.isArray(parsed.point) &&
            parsed.point.length === 2 &&
            typeof parsed.point[0] === "number" &&
            typeof parsed.point[1] === "number"
          ) {
            setPointState([parsed.point[0], parsed.point[1]]);
          }
          if (Array.isArray(parsed.cards)) {
            setCards(parsed.cards);
          }
          if (Array.isArray(parsed.messages)) {
            setMessages(parsed.messages);
          }
        }
      }
    } catch {
      // Ignore malformed localStorage entries and start fresh.
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      const payload: PersistedState = {
        region,
        point,
        cards,
        messages,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota / privacy mode failures.
    }
  }, [hydrated, region, point, cards, messages]);

  const setRegion = useCallback((nextRegion: Region | null) => {
    if (nextRegion === null) {
      setRegionState(null);
      setPointState(null);
      setCards([]);
      setMessages([]);
      return;
    }

    setRegionState((prev) => {
      if (prev && prev.slug !== nextRegion.slug) {
        setPointState(null);
        setCards([]);
        setMessages([]);
      }
      return nextRegion;
    });
  }, []);

  const setPoint = useCallback((nextPoint: [number, number] | null) => {
    setPointState(nextPoint);
  }, []);

  const setPendingPrompt = useCallback((prompt: string | null) => {
    setPendingPromptState(prompt);
  }, []);

  const addCard = useCallback(
    (input: Omit<CanvasCard, "id" | "createdAt">): CanvasCard => {
      const card: CanvasCard = {
        ...input,
        id: createId("card"),
        createdAt: Date.now(),
      };
      setCards((prev) => [...prev, card]);
      return card;
    },
    [],
  );

  const addMessage = useCallback(
    (input: Omit<ChatMessage, "id">): ChatMessage => {
      const message: ChatMessage = {
        ...input,
        id: createId("msg"),
      };
      setMessages((prev) => [...prev, message]);
      return message;
    },
    [],
  );

  const resetRegion = useCallback(() => {
    setRegionState(null);
    setPointState(null);
    setPendingPromptState(null);
    setCards([]);
    setMessages([]);
  }, []);

  return (
    <InvestigationContext.Provider
      value={{
        hydrated,
        region,
        point,
        pendingPrompt,
        cards,
        messages,
        setRegion,
        setPoint,
        setPendingPrompt,
        addCard,
        addMessage,
        resetRegion,
      }}
    >
      {children}
    </InvestigationContext.Provider>
  );
}

export function useInvestigation(): InvestigationContextValue {
  const ctx = useContext(InvestigationContext);
  if (!ctx) {
    throw new Error(
      "useInvestigation must be used inside an InvestigationProvider",
    );
  }
  return ctx;
}
