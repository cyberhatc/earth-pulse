import type { PlacePayload } from '../types/payload'

export default function CoverageBadge({ payload }: { payload: PlacePayload }) {
  const dc = payload.data_coverage
  const chips = Object.entries(dc.sources).slice(0, 8)
  return (
    <div className="card" aria-label="Data coverage and provenance">
      <h3>Data coverage &amp; provenance</h3>
      <div className="badge-row" style={{ marginBottom: 8 }}>
        {dc.synthetic_demo && <span className="chip synthetic">SYNTHETIC DEMO STORE</span>}
        <span className="chip">period {dc.time_range[0]} → {dc.time_range[1]}</span>
        <span className="chip">train overlap {dc.overlap_used_for_training[0]} → {dc.overlap_used_for_training[1]}</span>
      </div>
      <div className="chips">
        {chips.map(([param, source]) => (
          <span key={param} className="chip" title={source}>
            <b>{param}</b>: {source.split('(')[0].trim()}
          </span>
        ))}
      </div>
      <ul style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '8px 0 0', paddingLeft: 16 }}>
        {dc.gap_notes.map((g, i) => <li key={i}>{g}</li>)}
      </ul>
    </div>
  )
}
