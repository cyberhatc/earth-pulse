export function fmtNum(v: number, digits = 2): string {
  return Number.isFinite(v) ? v.toFixed(digits) : '—'
}

export function fmtSigned(v: number, digits = 2): string {
  if (!Number.isFinite(v)) return '—'
  return (v >= 0 ? '+' : '') + v.toFixed(digits)
}

export function trendArrow(direction: string): string {
  if (direction === 'increasing') return '↑'
  if (direction === 'decreasing') return '↓'
  return '→'
}

export function trendClass(direction: string): 'up' | 'down' | '' {
  if (direction === 'increasing') return 'up'
  if (direction === 'decreasing') return 'down'
  return ''
}

export function trendLabel(direction: string): string {
  if (direction === 'no trend') return 'no significant trend'
  return direction
}

export function significanceNote(p: number, significant: boolean): string {
  if (significant) return `Mann–Kendall significant (p=${p.toFixed(3)})`
  return `not statistically significant (p=${p.toFixed(3)})`
}

export const PARAM_META: Record<string, { label: string; unit: string; digits: number }> = {
  temperature: { label: '2m temperature', unit: '°C', digits: 1 },
  precipitation: { label: 'Precipitation', unit: 'mm/mo', digits: 0 },
  ndvi: { label: 'Vegetation (NDVI)', unit: 'index', digits: 2 },
  sst: { label: 'Sea surface temp', unit: '°C', digits: 1 },
  sea_level: { label: 'Sea level anomaly', unit: 'mm', digits: 0 },
  solar_radiation: { label: 'Solar radiation', unit: 'kWh/m²/day', digits: 2 },
  humidity: { label: 'Relative humidity', unit: '%', digits: 0 },
  wind: { label: 'Wind speed', unit: 'm/s', digits: 1 },
}

export function paramLabel(key: string): string {
  return PARAM_META[key]?.label ?? key
}
