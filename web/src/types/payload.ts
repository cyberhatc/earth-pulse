// Mirrors docs/api-contract.md (schema_version 1.0.0)

export interface Location {
  lat: number
  lon: number
  cell_index: number
  grid_lat: number
  grid_lon: number
  name: string | null
}

export interface DataCoverage {
  synthetic_demo: boolean
  parameters_used: string[]
  sources: Record<string, string>
  time_range: [string, string]
  overlap_used_for_training: [string, string]
  /** Preferred key emitted by api/routers/place.py */
  gap_notes?: string[]
  /** docs/api-contract.md calls the same field `gaps`; accept both */
  gaps?: string[]
  notes: string
}

export interface Anomaly {
  parameter: string
  date: string
  z: number
  severity: 'moderate' | 'high'
  kind: 'high' | 'low'
}

export interface GibsThumb {
  date: string
  layer: string
  z: number
  url: string
}

export interface PastBlock {
  dates: string[]
  timeseries: Record<string, number[]>
  imagery: GibsThumb[]
  anomalies: Anomaly[]
}

export interface TrendRecord {
  slope_per_decade: number
  p_value: number
  significant: boolean
  direction: string
  n: number
}

export interface ForecastParam {
  mean: number[]
  lower: number[]
  upper: number[]
}

export interface ProjectedImage {
  date: string
  parameter: string
  url: string
  label: string
}

export interface Backtest {
  mae?: number
  rmse?: number
  picp_p10_p90?: number
  vs_baselines?: Record<string, number>
  note?: string
}

export interface ForecastBlock {
  horizon_months: number
  issued: string
  model: string
  trained_artifact: boolean
  dates: string[]
  timeseries: Record<string, ForecastParam>
  backtest: Backtest | null
  projected_images: ProjectedImage[]
  scenarios: Array<{ name: string; generated_image_url: string | null; label: string }>
}

export interface OppositePair {
  parameter: string
  cell_a: { index: number; lat: number; lon: number; slope_per_decade: number; significant: boolean }
  cell_b: { index: number; lat: number; lon: number; slope_per_decade: number; significant: boolean }
  strength: 'strong' | 'weak'
  magnitude: number
  note?: string
  touches_clicked_cell?: boolean
}

export interface Explanation {
  text: string
  language: string
  generator: 'templated' | 'hf_inference' | 'gemini'
  confidence: 'low' | 'medium' | 'high'
}

export interface PlacePayload {
  schema_version: string
  location: Location
  data_coverage: DataCoverage
  past: PastBlock
  trends: Record<string, TrendRecord>
  forecast: ForecastBlock
  opposite_trends: OppositePair[]
  climate_twin: { cluster_id: number | null; k: number; features: string[] } | null
  explanation: Explanation
}
