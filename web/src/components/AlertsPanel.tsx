import { useEffect, useState } from 'react'

export interface WatchItem { id: string; name: string; lat: number; lon: number; added: string }

const KEY = 'ep-watchlist'

function load(): WatchItem[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}

export default function AlertsPanel({ current }: { current: { lat: number; lon: number } | null }) {
  const [items, setItems] = useState<WatchItem[]>(() => load())

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(items))
  }, [items])

  const isStarred = !!(current && items.some((i) => Math.abs(i.lat - current.lat) < 1e-6 && Math.abs(i.lon - current.lon) < 1e-6))

  function toggleStar() {
    if (!current) return
    const id = `${current.lat.toFixed(4)},${current.lon.toFixed(4)}`
    setItems((prev) =>
      prev.some((p) => p.id === id)
        ? prev.filter((p) => p.id !== id)
        : [...prev, { id, name: `Place ${current.lat.toFixed(2)}, ${current.lon.toFixed(2)}`, lat: current.lat, lon: current.lon, added: new Date().toISOString() }],
    )
  }

  function remove(id: string) {
    setItems((prev) => prev.filter((p) => p.id !== id))
  }

  function exportCsv() {
    const rows = [['name', 'lat', 'lon', 'added'], ...items.map((i) => [i.name, i.lat, i.lon, i.added])]
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'earth-pulse-watchlist.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="card">
      <h3>
        Watchlist
        <button className="icon-btn watch-star" onClick={toggleStar} aria-pressed={isStarred}
                aria-label={isStarred ? 'Remove current place' : 'Watch current place'} title={isStarred ? 'Remove from watchlist' : 'Add to watchlist'}>
          {isStarred ? '★ Watching' : '☆ Watch this place'}
        </button>
      </h3>
      <div className="watchlist-panel">
        {items.length === 0 && <p className="imagery-note">No watched places yet. Star the globe selection to keep a personal climate watchlist (stored locally in your browser).</p>}
        {items.map((i) => (
          <div className="watchlist-item" key={i.id}>
            <span>📍 {i.name}</span>
            <button className="icon-btn" onClick={() => remove(i.id)} aria-label={`Remove ${i.name}`}>✕</button>
          </div>
        ))}
        {items.length > 0 && (
          <button className="icon-btn" onClick={exportCsv}>⬇ Export CSV ({items.length})</button>
        )}
      </div>
    </div>
  )
}
