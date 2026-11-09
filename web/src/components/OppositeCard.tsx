import type { OppositePair } from '../types/payload'
import { fmtSigned } from '../lib/format'

interface Props { pairs: OppositePair[] }

// "Case file" cards: two neighboring cells, opposite-sign slopes for the same parameter.
export default function OppositeCard({ pairs }: Props) {
  if (!pairs.length) {
    return <div className="card"><h3>Opposite Trend Detective</h3><p className="imagery-note">No opposite-sign neighbor pair found for NDVI/precipitation near this cell. Neighboring grids here are broadly consistent.</p></div>
  }
  return (
    <div className="card">
      <h3>Opposite Trend Detective — case files</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {pairs.map((p, i) => {
          const wet = p.cell_a.slope_per_decade >= 0 ? 'cell_a' : 'cell_b'
          const dry = wet === 'cell_a' ? 'cell_b' : 'cell_a'
          const A = wet === 'cell_a' ? p.cell_a : p.cell_b
          const B = wet === 'cell_a' ? p.cell_b : p.cell_a
          return (
            <div className="case-file" key={i}>
              <div className="case-head">
                <span aria-hidden="true">◆</span> Case #{i + 1} — {p.parameter} · strength: {p.strength}
                {p.touches_clicked_cell && <span className="chip" style={{ marginLeft: 6 }}>clicked cell involved</span>}
              </div>
              <div className="row">
                <span title="greening / wetting side">🟢 {A.lat.toFixed(1)}°, {A.lon.toFixed(1)}° — slope <b>{fmtSigned(A.slope_per_decade, 3)}</b>/decade {A.significant ? '✓ MK-sig' : '(n.s.)'}</span>
              </div>
              <div className="row">
                <span title="browning / drying side">🟠 {B.lat.toFixed(1)}°, {B.lon.toFixed(1)}° — slope <b>{fmtSigned(B.slope_per_decade, 3)}</b>/decade {B.significant ? '✓ MK-sig' : '(n.s.)'}</span>
              </div>
              <p className="imagery-note" style={{ marginBottom: 0 }}>{p.note ?? 'Local drivers can dominate the regional signal — see the briefing below.'}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
