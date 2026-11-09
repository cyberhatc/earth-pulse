import { useState } from 'react'
import type { PlacePayload } from '../types/payload'
import CoverageBadge from './CoverageBadge'
import Charts from './Charts'
import ImageryGallery from './ImageryGallery'
import OppositeCard from './OppositeCard'
import ExplainerBox from './ExplainerBox'
import AlertsPanel from './AlertsPanel'
import { PARAM_META, fmtSigned, trendArrow, trendClass, significanceNote } from '../lib/format'

export const FORECAST_PARAMS = ['temperature', 'precipitation', 'ndvi', 'sst', 'sea_level', 'humidity', 'wind', 'solar_radiation'] as const

interface Props {
  payload: PlacePayload | null
  loading: boolean
  error: string | null
  onClose: () => void
  onRetry: () => void
  lowBandwidth: boolean
}

export default function PlacePanel({ payload, loading, error, onClose, onRetry, lowBandwidth }: Props) {
  const [active, setActive] = useState<string>('temperature')
  const open = !!(payload || loading || error)

  return (
    <aside className={`panel ${open ? 'open' : ''}`} role="dialog" aria-modal="false" aria-label="Place details">
      <div className="panel-head">
        <div>
          <h2>Place briefing</h2>
          <code>{payload ? `${payload.location.lat.toFixed(3)}, ${payload.location.lon.toFixed(3)} → grid ${payload.location.grid_lat.toFixed(1)}, ${payload.location.grid_lon.toFixed(1)} · cell #${payload.location.cell_index}` : 'click map'}</code>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close panel">✕</button>
      </div>

      <div className="panel-body">
        {loading && (
          <>
            <div className="skel" style={{ height: 74 }} />
            <div className="skel" style={{ height: 220 }} />
            <div className="skel" style={{ height: 140 }} />
          </>
        )}

        {error && !loading && (
          <div className="error-box" role="alert">
            <b>Couldn’t load this place.</b>
            <p style={{ margin: '6px 0' }}>{error}</p>
            <button className="icon-btn retry-btn" onClick={onRetry}>↻ Retry</button>
          </div>
        )}

        {payload && !loading && (
          <>
            <CoverageBadge payload={payload} />

            {/* parameter pills */}
            <div className="param-pills" role="tablist" aria-label="Parameter">
              {FORECAST_PARAMS.map((p) => (
                <button key={p} role="tab" aria-pressed={active === p} className="pill" onClick={() => setActive(p)}>
                  {PARAM_META[p]?.label ?? p}
                </button>
              ))}
            </div>

            <Charts payload={payload} parameter={active} />

            {/* trend summary grid */}
            <div className="card">
              <h3>Long-term trends (Theil–Sen · Mann–Kendall)</h3>
              <div className="trend-grid">
                {Object.entries(payload.trends).map(([param, t]) => (
                  <div className="trend-cell" key={param}>
                    <div className="k">{PARAM_META[param]?.label ?? param}</div>
                    <div className="v {trendClass(t.direction)}">{trendArrow(t.direction)} {fmtSigned(t.slope_per_decade, 2)}<small>/dec</small></div>
                    <div className="sig">{significanceNote(t.p_value, t.significant)}</div>
                  </div>
                ))}
              </div>
            </div>

            <ImageryGallery payload={payload} lowBandwidth={lowBandwidth} />
            <OppositeCard pairs={payload.opposite_trends} />
            <ExplainerBox explanation={payload.explanation} />
            <AlertsPanel current={payload.location} />

            <p className="imagery-note">
              Climate twins: this place belongs to cluster <b>#{payload.climate_twin?.cluster_id ?? '—'}</b> (K-Means, k={payload.climate_twin?.k ?? '—'}) of similar climate signatures.
              Forecast = probabilistic p10–p90 outlook, not a certain future.
            </p>
          </>
        )}
      </div>
    </aside>
  )
}
