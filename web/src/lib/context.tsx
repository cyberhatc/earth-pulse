import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getRegion } from "./data";
import {
  fetchHealth,
  fetchPlace,
  type BackendHealth,
  type BackendPlace,
} from "./api";
import {
  demoAnalysis,
  deriveLiveAnalysis,
  type LiveAnalysis,
  type LiveStatus,
} from "./live";
import type { CanvasCard, ChatMessage, Region } from "./types";

const STORAGE_KEY = "etd.investigation.v1";
const MAX_PERSISTED_MESSAGES = 50;

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
  live: {
    payload: BackendPlace | null;
    status: LiveStatus;
    error: string | null;
    analysis: LiveAnalysis | null;
  };
  health: BackendHealth | null;
  healthError: string | null;
  refreshLive: () => void;
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
  const [livePayload, setLivePayload] = useState<BackendPlace | null>(null);
  const [liveStatus, setLiveStatus] = useState<LiveStatus>("loading");
  const [liveError, setLiveError] = useState<string | null>(null);
  const [health, setHealth] = useState<BackendHealth | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

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
            setMessages(parsed.messages.slice(-MAX_PERSISTED_MESSAGES));
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
        messages: messages.slice(-MAX_PERSISTED_MESSAGES),
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota / privacy mode failures.
    }
  }, [hydrated, region, point, cards, messages]);

  // Backend liveness + local LLM (Ollama) status.
  useEffect(() => {
    const controller = new AbortController();
    fetchHealth(controller.signal)
      .then((next) => {
        setHealth(next);
        setHealthError(null);
      })
      .catch((err: Error) => {
        if (controller.signal.aborted) return;
        setHealth(null);
        setHealthError(err.message);
      });
    return () => controller.abort();
  }, [reloadTick]);

  // Live /place payload for the selected region (or pinned point).
  useEffect(() => {
    if (!region) {
      setLivePayload(null);
      setLiveStatus("loading");
      setLiveError(null);
      return;
    }
    const controller = new AbortController();
    const [lat, lon] = point ?? region.center;
    setLivePayload(null);
    setLiveStatus("loading");
    setLiveError(null);
    fetchPlace(lat, lon, 60, controller.signal)
      .then((next) => {
        setLivePayload(next);
        setLiveStatus("live");
      })
      .catch((err: Error) => {
        if (controller.signal.aborted) return;
        setLivePayload(null);
        setLiveStatus("error");
        setLiveError(err.message);
      });
    return () => controller.abort();
  }, [region, point, reloadTick]);

  const liveAnalysis = useMemo<LiveAnalysis | null>(() => {
    if (!region) return null;
    if (livePayload) return deriveLiveAnalysis(region, livePayload, point);
    return demoAnalysis(
      region,
      point,
      liveStatus === "error" ? "error" : "loading",
      liveError ??
        "Loading the live backend payload; showing the demonstration series meanwhile.",
    );
  }, [region, livePayload, point, liveStatus, liveError]);

  const refreshLive = useCallback(() => {
    setReloadTick((tick) => tick + 1);
  }, []);

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

  const value = useMemo<InvestigationContextValue>(
    () => ({
      hydrated,
      region,
      point,
      pendingPrompt,
      cards,
      messages,
      live: {
        payload: livePayload,
        status: liveStatus,
        error: liveError,
        analysis: liveAnalysis,
      },
      health,
      healthError,
      refreshLive,
      setRegion,
      setPoint,
      setPendingPrompt,
      addCard,
      addMessage,
      resetRegion,
    }),
    [
      hydrated,
      region,
      point,
      pendingPrompt,
      cards,
      messages,
      livePayload,
      liveStatus,
      liveError,
      liveAnalysis,
      health,
      healthError,
      refreshLive,
      setRegion,
      setPoint,
      setPendingPrompt,
      addCard,
      addMessage,
      resetRegion,
    ],
  );

  return (
    <InvestigationContext.Provider value={value}>
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
