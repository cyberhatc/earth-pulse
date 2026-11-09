import { useMemo, useState } from 'react'
import { paramLabel, fmtNum, fmtSigned, significanceNote } from '../lib/format'
import { t } from '../lib/i18n'
import type { PlacePayload } from '../types/payload'

interface Props {
  payload: PlacePayload
  parameter: string
  offline?: boolean
}

// Dependency-free SVG line chart: observed series (solid) + forecast (dashed)
// with a p10–p90 uncertainty ribbon and a Theil–Sen trend line/marker.
export default function Charts({ payload, parameter, offline = false }: Props) {
  const [showTable, setShowTable] = useState(false)
  const W = 620, H = 230, PAD = { l: 44, r: 10, t: 12, b: 26 }
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b

  const model = useMemo(() => {
    const past = payload.past.timeseries[parameter] ?? []
    const fc = payload.forecast.timeseries[parameter]
    if (!past.length || !fc) return null
    const nPast = past.length
    const n = nPast + fc.mean.length
    const trend = payload.trends[parameter]

    // Theil–Sen slope is per decade; convert to the monthly step used here.
    const trendEnd = trend ? past[0] + (trend.slope_per_decade / 120) * (nPast - 1) : null

    const all = [...past, ...fc.mean, ...fc.lower, ...fc.upper]
    if (trendEnd != null && Number.isFinite(trendEnd)) all.push(trendEnd)
    const yMin = Math.min(...all)
    const yMax = Math.max(...all)
    const span = yMax - yMin || 1e-6
    const pad = span * 0.08
    const y0 = yMin - pad, y1 = yMax + pad

    const x = (i: number) => PAD.l + (i / Math.max(1, n - 1)) * iw
    const y = (v: number) => PAD.t + ih - ((v - y0) / (y1 - y0)) * ih

    const bandPath =
      `M ${fc.upper.map((v, i) => `${x(nPast + i).toFixed(1)},${y(v).toFixed(1)}`).join(' L ')} ` +
      `L ${[...fc.lower].reverse().map((v, i) => `${x(nPast + fc.lower.length - 1 - i).toFixed(1)},${y(v).toFixed(1)}`).join(' L ')} Z`

    const ticks = Array.from({ length: 4 }, (_, i) => y0 + ((i + 0.5) / 4) * (y1 - y0))
    const lastPastX = x(nPast - 1)

    return { past, fc, x, y, bandPath, y0, y1, ticks, lastPastX, n, nPast, trend, trendEnd }
  }, [payload, parameter])

  if (!model) {
    return <div className="card">{t('noCoverage')} <b>{paramLabel(parameter)}</b></div>
  }

  const { past, fc, x, y, bandPath, ticks, lastPastX, n, nPast, trend, trendEnd } = model
  const issuedYear = payload.forecast.issued?.slice(0, 4) ?? ''
  const hasTrendLine = trend != null && trendEnd != null && Number.isFinite(trendEnd)

  return (
    <div className="chart-box" aria-label={`${paramLabel(parameter)} time series`}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${paramLabel(parameter)} observed and forecast`}>
        {/* gridlines + y labels */}
        {ticks.map((tv, i) => (
          <g key={i}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(tv)} y2={y(tv)} stroke="var(--border)" strokeDasharray="2 4" />
            <text x={PAD.l - 6} y={y(tv) + 3} textAnchor="end" fontSize="9" fill="var(--text-muted)">{fmtNum(tv, 1)}</text>
          </g>
        ))}

        {/* observed trend line (Theil–Sen) + significance marker */}
        {hasTrendLine && (
          <g className="trend-overlay">
            <line
              x1={x(0)} y1={y(past[0])} x2={x(nPast - 1)} y2={y(trendEnd!)}
              stroke="var(--trend-up)" strokeWidth="1.3" strokeDasharray="3 5" opacity="0.85"
            />
            <circle
              cx={x(nPast - 1)} cy={y(trendEnd!)} r={trend!.significant ? 4 : 3}
              fill={trend!.significant ? 'var(--trend-up)' : 'var(--surface)'}
              stroke="var(--trend-up)" strokeWidth="1.5"
            />
            <text x={x(nPast - 1) - 4} y={y(trendEnd!) - 7} textAnchor="end" fontSize="8.5" fill="var(--trend-up)" fontWeight="700">
              trend {fmtSigned(trend!.slope_per_decade, 2)}/dec
            </text>
          </g>
        )}

        {/* divider: last observed month / forecast issue date */}
        <line x1={lastPastX} x2={lastPastX} y1={PAD.t} y2={PAD.t + ih} stroke="var(--accent)" strokeWidth="1.4" strokeDasharray="5 4" opacity="0.8" />
        <text x={lastPastX + 3} y={PAD.t + 10} fontSize="8.5" fill="var(--accent-strong)" fontWeight="700">{issuedYear}</text>

        {/* forecast uncertainty ribbon */}
        <path d={bandPath} fill="var(--band)" stroke="none" />

        {/* observed line */}
        <polyline
          points={past.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}
          fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round"
        />

        {/* forecast line (dashed) */}
        <polyline
          points={fc.mean.map((v, i) => `${x(nPast + i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}
          fill="none" stroke="var(--accent-strong)" strokeWidth="1.8" strokeDasharray="6 4" strokeLinejoin="round"
        />

        {/* x start/end labels */}
        <text x={PAD.l} y={H - 8} fontSize="9" fill="var(--text-muted)">{payload.past.dates[0]}</text>
        <text x={W - PAD.r} y={H - 8} textAnchor="end" fontSize="9" fill="var(--text-muted)">{payload.forecast.dates[payload.forecast.dates.length - 1]}</text>
      </svg>

      <div className="chart-note">
        <span className="tag observed" style={{ marginRight: 6 }}>Observed</span>
        <span className="tag forecast">Forecast p10–p90</span>
        {hasTrendLine && (
          <span className={`sig-badge ${trend!.significant ? 'sig-yes' : 'sig-no'}`} title={significanceNote(trend!.p_value, trend!.significant)}>
            <span className="sig-dot" aria-hidden="true" />
            MK {trend!.significant ? 'significant' : 'n.s.'} p={trend!.p_value < 0.001 ? '<0.001' : trend!.p_value.toFixed(3)}
          </span>
        )}
        {offline && <span className="chip" style={{ marginLeft: 6 }}>offline sample</span>}
        <div style={{ marginTop: 4 }}>
          {' · '}model: {payload.forecast.model}{payload.forecast.trained_artifact ? ' (trained artifact)' : ' (seasonal-trend fallback)'}
          {' · '}n={n}
          {' · '}
          <button className="pill" style={{ marginLeft: 4 }} onClick={() => setShowTable((s) => !s)} aria-expanded={showTable}>
            {showTable ? t('hideRawValues') : t('rawValues')}
          </button>
        </div>
      </div>

      {showTable && (
        <div style={{ maxHeight: 160, overflow: 'auto', fontSize: 11 }}>
          <table>
            <thead><tr><th>Date</th><th>Value</th><th>Lower</th><th>Upper</th></tr></thead>
            <tbody>
              {past.map((v, i) => (
                <tr key={'p' + i}><td>{payload.past.dates[i]}</td><td>{fmtNum(v, 3)}</td><td>—</td><td>—</td></tr>
              ))}
              {fc.mean.map((v, i) => (
                <tr key={'f' + i}><td>{payload.forecast.dates[i]}</td><td>{fmtNum(v, 3)}</td><td>{fmtNum(fc.lower[i], 3)}</td><td>{fmtNum(fc.upper[i], 3)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
