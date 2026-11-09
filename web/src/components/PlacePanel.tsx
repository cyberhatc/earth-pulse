import { useEffect, useState } from 'react'
import type { PlacePayload } from '../types/payload'
import CoverageBadge from './CoverageBadge'
import Charts from './Charts'
import ImageryGallery from './ImageryGallery'
import OppositeCard from './OppositeCard'
import ExplainerBox from './ExplainerBox'
import AlertsPanel from './AlertsPanel'
import { PARAM_META, fmtSigned, trendArrow, trendClass, significanceNote } from '../lib/format'
import { t } from '../lib/i18n'

export const FORECAST_PARAMS = ['temperature', 'precipitation', 'ndvi', 'sst', 'sea_level', 'humidity', 'wind', 'solar_radiation'] as const

type Tab = 'overview' | 'imagery' | 'opposite' | 'why'

const TABS: Array<{ id: Tab; labelKey: string }> = [
  { id: 'overview', labelKey: 'tabOverview' },
  { id: 'imagery', labelKey: 'tabImagery' },
  { id: 'opposite', labelKey: 'tabOpposite' },
  { id: 'why', labelKey: 'tabWhy' },
]

interface Props {
  payload: PlacePayload | null
  loading: boolean
  error: string | null
  usingFallback?: boolean
  onClose: () => void
  onRetry: () => void
  onUseFallback?: () => void
  lowBandwidth: boolean
}

export default function PlacePanel({
  payload, loading, error, usingFallback = false, onClose, onRetry, onUseFallback, lowBandwidth,
}: Props) {
  const [active, setActive] = useState<string>('temperature')
  const [tab, setTab] = useState<Tab>('overview')
  const open = !!(payload || loading || error)

  // A new place (or switching to the offline sample) always starts at Overview.
  useEffect(() => {
    setTab('overview')
  }, [payload?.location.cell_index, usingFallback])

  return (
    <aside className={`panel ${open ? 'open' : ''}`} role="dialog" aria-modal="false" aria-label={t('panelTitle')}>
      <div className="panel-head">
        <div>
          <h2>{t('panelTitle')}</h2>
          <code>
            {payload
              ? `${payload.location.lat.toFixed(3)}, ${payload.location.lon.toFixed(3)} → grid ${payload.location.grid_lat.toFixed(1)}, ${payload.location.grid_lon.toFixed(1)} · cell #${payload.location.cell_index}`
              : t('panelHint')}
          </code>
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

        {error && !loading && !payload && (
          <div className="error-box" role="alert">
            <b>{t('errorTitle')}</b>
            <p style={{ margin: '6px 0' }}>{error}</p>
            <div className="badge-row">
              <button className="icon-btn retry-btn" onClick={onRetry}>↻ {t('retry')}</button>
              {onUseFallback && (
                <button className="icon-btn" onClick={onUseFallback}>🗂 {t('showSample')}</button>
              )}
            </div>
          </div>
        )}

        {payload && !loading && (
          <>
            {usingFallback && (
              <div className="fallback-banner" role="status">
                <b>{t('offlineBanner')}</b>
                <div className="badge-row" style={{ marginTop: 8 }}>
                  <button className="icon-btn" onClick={onRetry}>↻ {t('offlineRetry')}</button>
                  <button className="icon-btn" onClick={onClose}>{t('offlineHide')}</button>
                </div>
              </div>
            )}

            <CoverageBadge payload={payload} />

            <div className="panel-tabs" role="tablist" aria-label="Place briefing sections">
              {TABS.map((item) => (
                <button
                  key={item.id}
                  id={`tab-${item.id}`}
                  role="tab"
                  aria-selected={tab === item.id}
                  aria-controls={`tabpanel-${item.id}`}
                  className="panel-tab"
                  onClick={() => setTab(item.id)}
                >
                  {t(item.labelKey)}
                </button>
              ))}
            </div>

            <div
              className="tab-content"
              id={`tabpanel-${tab}`}
              role="tabpanel"
              aria-labelledby={`tab-${tab}`}
            >
              {tab === 'overview' && (
                <>
                  <div className="param-pills" role="tablist" aria-label="Parameter">
                    {FORECAST_PARAMS.map((p) => (
                      <button key={p} role="tab" aria-pressed={active === p} className="pill" onClick={() => setActive(p)}>
                        {PARAM_META[p]?.label ?? p}
                      </button>
                    ))}
                  </div>

                  <Charts payload={payload} parameter={active} offline={usingFallback} />

                  <div className="card">
                    <h3>Long-term trends (Theil–Sen · Mann–Kendall)</h3>
                    <div className="trend-grid">
                      {Object.entries(payload.trends).map(([param, trend]) => (
                        <div className="trend-cell" key={param}>
                          <div className="k">{PARAM_META[param]?.label ?? param}</div>
                          <div className={`v ${trendClass(trend.direction)}`}>
                            {trendArrow(trend.direction)} {fmtSigned(trend.slope_per_decade, 2)}<small>/dec</small>
                          </div>
                          <div className={`sig ${trend.significant ? 'sig-yes' : 'sig-no'}`}>
                            <span className="sig-dot" aria-hidden="true" />
                            {significanceNote(trend.p_value, trend.significant)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <p className="imagery-note">
                    Climate twins: this place belongs to cluster <b>#{payload.climate_twin?.cluster_id ?? '—'}</b>
                    {' '}(K-Means, k={payload.climate_twin?.k ?? '—'}) of similar climate signatures.
                  </p>

                  <AlertsPanel current={usingFallback ? null : payload.location} />
                </>
              )}

              {tab === 'imagery' && (
                <ImageryGallery payload={payload} lowBandwidth={lowBandwidth} offline={usingFallback} />
              )}

              {tab === 'opposite' && <OppositeCard pairs={payload.opposite_trends} />}

              {tab === 'why' && (
                <>
                  <ExplainerBox explanation={payload.explanation} />
                  <div className="card">
                    <h3>How to read this briefing</h3>
                    <ul className="why-list">
                      <li><b>Observed</b> series come from the data store; the top strip states whether that store is synthetic.</li>
                      <li><b>Trend</b> = Theil–Sen slope per decade; the marker states whether Mann–Kendall finds it statistically significant.</li>
                      <li><b>Forecast</b> = model outlook with a p10–p90 uncertainty ribbon. It is probabilistic, not a promised future.</li>
                      <li><b>Projected maps</b> extrapolate the fitted trend and are labelled model-projected — never observations.</li>
                      <li><b>AI-generated scenarios</b> (when enabled) are illustrative only and are labelled as such.</li>
                    </ul>
                  </div>
                </>
              )}
            </div>

            <p className="imagery-note">
              Forecast = probabilistic p10–p90 outlook, not a certain future.
            </p>
          </>
        )}
      </div>
    </aside>
  )
}
