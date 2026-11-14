import type { PlacePayload } from '../types/payload'

const API_BASE: string = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') || ''

export function apiUrl(path: string): string {
  if (API_BASE) return `${API_BASE}${path}`
  // dev proxy (/api/*) — see vite.config.ts
  return `/api${path}`
}

export class ApiError extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.status = status
  }
}

async function getJson<T>(path: string, timeoutMs = 20000): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(apiUrl(path), { signal: controller.signal })
    if (!res.ok) {
      let detail = res.statusText
      try {
        const body = await res.json()
        detail = body?.detail ?? body?.error ?? detail
      } catch { /* keep statusText */ }
      throw new ApiError(`API ${res.status}: ${detail}`, res.status)
    }
    return (await res.json()) as T
  } catch (err) {
    if (err instanceof ApiError) throw err
    if ((err as Error).name === 'AbortError') throw new ApiError('Request timed out. Is the API running?')
    throw new ApiError(`Network error: ${(err as Error).message}. Is the API reachable at ${API_BASE || '/api (dev proxy)'}?`)
  } finally {
    clearTimeout(timer)
  }
}

export function fetchPlace(lat: number, lon: number, horizonMonths = 60): Promise<PlacePayload> {
  return getJson<PlacePayload>(`/place?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}&horizon_months=${horizonMonths}`, 60000)
}

export function fetchPoint(lat: number, lon: number, horizonMonths = 60): Promise<PlacePayload> {
  return getJson<PlacePayload>(`/point?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}&horizon_months=${horizonMonths}`, 120000)
}

export function fetchHealth(): Promise<{ status: string }> {
  return getJson('/health', 8000)
}

export interface TimeLapseFrame {
  year: number
  date: string
  kind: 'observed' | 'projected'
  url: string
  label: string
}

export function fetchTimeLapse(lat: number, lon: number, startYear = 2000, endYear = 2030): Promise<{ point: { lat: number; lon: number }; frames: TimeLapseFrame[]; note: string }> {
  return getJson(`/imagery/timelapse?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}&start_year=${startYear}&end_year=${endYear}`, 30000)
}
