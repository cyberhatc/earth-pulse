// Client for the Earth Pulse / NASA backend (FastAPI on :8000).
//
// Dev: Vite proxies /api -> http://localhost:8000 (see vite.config.ts).
// Prod: set VITE_API_BASE to the deployed API origin, e.g.
//   VITE_API_BASE=https://your-api.example.org npm run build

import type { ChatSource } from "./types";

export type BackendTrend = {
  slope_per_decade: number;
  p_value: number;
  significant: boolean;
  direction: string;
  n: number;
};

export type BackendCoverage = {
  synthetic_demo: boolean;
  parameters_used: string[];
  parameters_unavailable?: string[];
  ocean_cell?: boolean | null;
  parameter_relevance?: Record<string, string>;
  sources: Record<string, string>;
  time_range: [string, string];
  overlap_used_for_training?: [string, string];
  gap_notes?: string[];
  gaps?: string[];
  notes?: string;
};

export type BackendForecast = {
  horizon_months: number;
  issued: string;
  model: string;
  artifact?: string | null;
  trained_artifact?: boolean;
  dates: string[];
  timeseries: Record<
    string,
    { mean: number[]; lower: number[]; upper: number[] }
  >;
  backtest?: {
    mae?: number;
    rmse?: number;
    picp_p10_p90?: number;
    per_parameter?: Record<
      string,
      { mae: number; rmse: number; picp_p10_p90: number; bias?: number }
    >;
    vs_baselines?: Record<string, number>;
    note?: string;
  } | null;
  projected_images?: { date: string; parameter: string; url: string; label: string }[];
  scenarios?: { name: string; generated_image_url: string | null; label: string }[];
};

export type BackendOpposite = {
  parameter: string;
  cell_a: {
    index?: number;
    lat: number;
    lon: number;
    slope_per_decade: number;
    significant?: boolean;
  };
  cell_b: {
    index?: number;
    lat: number;
    lon: number;
    slope_per_decade: number;
    significant?: boolean;
  };
  strength: string;
  magnitude?: number;
  note?: string;
  touches_clicked_cell?: boolean;
};

export type BackendAnomaly = {
  parameter: string;
  date: string;
  z: number;
  severity: string;
  kind: string;
};

export type BackendPlace = {
  schema_version: string;
  location: {
    lat: number;
    lon: number;
    cell_index: number;
    grid_lat: number;
    grid_lon: number;
    name: string | null;
  };
  data_coverage: BackendCoverage;
  past: {
    dates: string[];
    timeseries: Record<string, (number | null)[]>;
    imagery: { date: string; layer: string; z?: number; url: string }[];
    anomalies: BackendAnomaly[];
  };
  trends: Record<string, BackendTrend>;
  forecast: BackendForecast;
  opposite_trends: BackendOpposite[];
  climate_twin: { cluster_id: number | null; k: number; features: string[] } | null;
  explanation: {
    text: string;
    language: string;
    generator: string;
    confidence: string;
    model?: string | null;
  };
};

export type BackendHealth = {
  status: string;
  schema_version?: string;
  sample_store?: boolean;
  store?: {
    path: string;
    name: string;
    exists: boolean;
    synthetic?: boolean;
    real_data?: boolean;
    provenance?: string | null;
    time_range?: string[];
    n_months?: number;
    error?: string;
  };
  analysis?: boolean;
  analysis_path?: string;
  llm?: {
    backend: string;
    available: boolean;
    model: string | null;
    base_url: string | null;
    installed_models?: string[];
    note?: string;
  };
  rag?: {
    backend: string;
    enabled: boolean;
    model?: string | null;
    space_url?: string | null;
    timeout_s?: number;
    top_k?: number;
    kb_path?: string;
    kb_chunks?: number;
    kb_error?: string;
    token_configured?: boolean;
    note?: string;
  };
};

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type ChatReply = {
  text: string;
  generator: string;
  model: string | null;
  confidence: string;
  card_kind: string;
  llm_available: boolean;
  guard_reason?: string | null;
  guard_numbers?: number[];
  sources?: ChatSource[];
  facts?: Record<string, unknown>;
};

const RAW_BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.trim();
export const API_BASE = (RAW_BASE || "/api").replace(/\/$/, "");
export const API_ORIGIN =
  RAW_BASE && /^https?:\/\//.test(RAW_BASE) ? RAW_BASE.replace(/\/$/, "") : "";

export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(
  path: string,
  init?: RequestInit,
  timeoutMs = 20000,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: init?.signal ?? controller.signal,
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(init?.headers || {}),
      },
    });
    if (!res.ok) {
      let detail = res.statusText;
      try {
        const body = (await res.json()) as { detail?: string; error?: string };
        detail = body.detail || body.error || detail;
      } catch {
        // keep statusText
      }
      throw new ApiError(`API ${res.status}: ${detail}`, res.status);
    }
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if ((err as Error).name === "AbortError") {
      throw new ApiError(
        "Backend request timed out. Is FastAPI running on :8000?",
      );
    }
    throw new ApiError(
      `Cannot reach the Earth Pulse backend at ${API_BASE}. Start it with: uvicorn api.main:app --port 8000`,
    );
  } finally {
    clearTimeout(timer);
  }
}

export type GridCellTrend = {
  lat: number;
  lon: number;
  slope_per_decade: number;
  p_value: number;
  significant: boolean;
  direction: string;
};

export type BackendGridTrends = {
  variable: string;
  n_cells: number;
  synthetic_demo: boolean;
  time_range: [string, string] | null;
  cells: GridCellTrend[];
};

export function fetchGridTrends(
  variable: string,
  signal?: AbortSignal,
): Promise<BackendGridTrends> {
  return request<BackendGridTrends>(
    `/trends/grid?variable=${encodeURIComponent(variable)}`,
    { signal },
    30000,
  );
}

export function fetchHealth(signal?: AbortSignal): Promise<BackendHealth> {
  return request<BackendHealth>("/health", { signal }, 8000);
}

export function fetchPlace(
  lat: number,
  lon: number,
  horizonMonths = 60,
  signal?: AbortSignal,
): Promise<BackendPlace> {
  return request<BackendPlace>(
    `/place?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}&horizon_months=${horizonMonths}`,
    { signal },
    60000,
  );
}

export function sendChat(
  input: {
    lat: number;
    lon: number;
    messages: ChatTurn[];
    regionName?: string;
    variable?: string;
    horizonMonths?: number;
    language?: string;
  },
  signal?: AbortSignal,
): Promise<ChatReply> {
  return request<ChatReply>(
    "/chat",
    {
      method: "POST",
      signal,
      body: JSON.stringify({
        lat: input.lat,
        lon: input.lon,
        messages: input.messages,
        region_name: input.regionName ?? null,
        variable: input.variable ?? null,
        horizon_months: input.horizonMonths ?? 60,
        language: input.language ?? "en",
      }),
    },
    120000,
  );
}

export type BackendImageryPast = {
  point: { lat: number; lon: number };
  gibs: Array<{ label?: string; date: string; type: string; layer: string; url: string }>;
  landsat_query?: { url?: string; note?: string } | string;
  note?: string;
};

export type BackendTimelapse = {
  parameter: string;
  lat: number;
  lon: number;
  frames: Array<{ index?: number; date: string; year: number; svg: string }>;
  note?: string;
  error?: string;
};

export type BackendScenario = {
  parameter: string;
  lat: number;
  lon: number;
  enabled: boolean;
  label: string;
  prompt: string;
  negative_prompt: string;
  conditioning: Record<string, unknown>;
  gibs_reference_url: string | null;
  how_to_generate: string;
};

function buildApiUrl(path: string): string {
  const base = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, "") ?? "/api";
  return `${base.replace(/\/$/, "")}${path}`;
}

export async function fetchImageryPast(
  lat: number,
  lon: number,
  signal?: AbortSignal,
): Promise<BackendImageryPast> {
  const q = new URLSearchParams({ lat: String(lat), lon: String(lon) });
  return request(`/imagery/past?${q.toString()}`, { method: "GET", signal });
}

export async function fetchTimelapse(
  lat: number,
  lon: number,
  parameter: string,
  signal?: AbortSignal,
): Promise<BackendTimelapse> {
  const q = new URLSearchParams({ lat: String(lat), lon: String(lon), parameter });
  return request(`/imagery/timelapse?${q.toString()}`, { method: "GET", signal });
}

export function timelapseGifUrl(lat: number, lon: number, parameter: string): string {
  const q = new URLSearchParams({ lat: String(lat), lon: String(lon), parameter });
  return buildApiUrl(`/imagery/timelapse.gif?${q.toString()}`);
}

export function projectedImageUrl(parameter: string, year: number): string {
  const q = new URLSearchParams({ parameter, year: String(year) });
  return buildApiUrl(`/imagery/projected?${q.toString()}`);
}

export async function fetchScenario(
  lat: number,
  lon: number,
  parameter = "ndvi",
  horizonMonths = 60,
  signal?: AbortSignal,
): Promise<BackendScenario> {
  const q = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    parameter,
    horizon_months: String(horizonMonths),
  });
  return request(`/imagery/scenario?${q.toString()}`, { method: "GET", signal });
}
