import { useEffect, useState } from 'react'
import { fetchTimeLapse, type TimeLapseFrame } from '../lib/api'

interface Props {
  lat: number
  lon: number
}

export default function TimeLapse({ lat, lon }: Props) {
  const [frames, setFrames] = useState<TimeLapseFrame[]>([])
  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchTimeLapse(lat, lon, 2000, 2030)
      .then((r) => { if (!cancelled) { setFrames(r.frames); setIdx(0) } })
      .catch((e: Error) => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [lat, lon])

  useEffect(() => {
    if (!playing || frames.length === 0) return
    const t = setInterval(() => setIdx((i) => (i + 1) % frames.length), 700)
    return () => clearInterval(t)
  }, [playing, frames.length])

  if (loading) return <div className="skel" style={{ height: 220 }} />
  if (error) return <div className="error-box">{error}</div>
  if (!frames.length) return null

  const frame = frames[idx]

  return (
    <div className="card">
      <h3>Time-lapse: 2000 → 2030</h3>
      <div style={{ position: 'relative', textAlign: 'center' }}>
        <img
          src={frame.url}
          alt={frame.label}
          style={{ width: '100%', maxWidth: 480, borderRadius: 8, border: '1px solid var(--border, #ccc)' }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
        <div style={{ marginTop: 8, fontWeight: 600 }}>
          {frame.label}
          <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.7 }}>
            ({frame.kind === 'observed' ? 'observed' : 'model-projected'})
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
        <button className="icon-btn" onClick={() => setPlaying((p) => !p)}>
          {playing ? '⏸ Pause' : '▶ Play'}
        </button>
        <input
          type="range"
          min={0}
          max={frames.length - 1}
          value={idx}
          onChange={(e) => { setPlaying(false); setIdx(Number(e.target.value)) }}
          style={{ flex: 1, minWidth: 120 }}
        />
        <span style={{ fontSize: 12, minWidth: 40 }}>{frame.year}</span>
      </div>
      <p className="imagery-note" style={{ marginTop: 8 }}>
        Observed frames = MODIS true-colour tiles (GIBS). Future frames = model-projected
        temperature heatmaps (not observations). Imagery may take a moment to load.
      </p>
    </div>
  )
}