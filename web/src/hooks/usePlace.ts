import { useEffect, useRef, useState } from 'react'
import { fetchPlace, fetchPoint } from '../lib/api'
import type { PlacePayload } from '../types/payload'

export interface UsePlaceState {
  data: PlacePayload | null
  loading: boolean
  error: string | null
  reload: () => void
}

export function usePlace(lat: number | null, lon: number | null, horizonMonths = 60, mode: 'grid' | 'point' = 'grid'): UsePlaceState {
  const [data, setData] = useState<PlacePayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const abort = useRef(0)

  useEffect(() => {
    if (lat == null || lon == null) {
      setData(null)
      setError(null)
      setLoading(false)
      return
    }
    const myId = ++abort.current
    setLoading(true)
    setError(null)
    setData(null)
    const req = mode === 'point' ? fetchPoint(lat, lon, horizonMonths) : fetchPlace(lat, lon, horizonMonths)
    req
      .then((payload) => {
        if (abort.current !== myId) return
        setData(payload)
        setLoading(false)
      })
      .catch((err: Error) => {
        if (abort.current !== myId) return
        setError(err.message)
        setLoading(false)
      })
  }, [lat, lon, horizonMonths, tick, mode])

  return { data, loading, error, reload: () => setTick((n) => n + 1) }
}