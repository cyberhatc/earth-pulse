import type { PlacePayload } from '../types/payload'
import { apiUrl } from '../lib/api'

interface Props { payload: PlacePayload; lowBandwidth: boolean }

// Past: real GIBS map tiles (what a map-level product shows) + Landsat link for true scenes.
// Future: model-projected SVG heat maps (data-driven, labeled) — NOT a photo.
export default function ImageryGallery({ payload, lowBandwidth }: Props) {
  const past = payload.past.imagery ?? []
  const projected = payload.forecast.projected_images ?? []
  const apiBase = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') || ''

  if (lowBandwidth) {
    return (
      <div className="card">
        <h3>Imagery (low-bandwidth mode)</h3>
        <p className="imagery-note">Imagery hidden. All numbers and charts above remain fully available. Toggle low-bandwidth off to load GIBS tiles.</p>
      </div>
    )
  }

  return (
    <div className="card">
      <h3>Imagery — past, present &amp; projected</h3>

      <div className="badge-row" style={{ marginBottom: 6 }}><span className="tag observed">Observed (map tiles)</span></div>
      <div className="imagery-grid">
        {past.map((img) => (
          <figure className="imagery-item" key={img.url}>
            <img src={img.url} loading="lazy" alt={`${img.layer} over selected location on ${img.date}`} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
            <figcaption>{img.layer.replace(/_/g, ' ')} · {img.date}</figcaption>
          </figure>
        ))}
      </div>
      <a className="btn-link" href={`https://earthexplorer.usgs.gov/?searchType=specificPlace#results`} target="_blank" rel="noreferrer">
        Open USGS EarthExplorer (Landsat scenes) for this point →
      </a>

      <div className="badge-row" style={{ margin: '10px 0 6px' }}><span className="tag forecast">Model-projected</span></div>
      <div className="imagery-grid">
        {projected.map((img) => (
          <figure className="imagery-item" key={img.url}>
            <img src={apiBase ? apiBase + img.url : img.url} loading="lazy" alt={img.label} />
            <figcaption>{img.parameter} · {img.date} · {img.label.split('—')[0].trim()}</figcaption>
          </figure>
        ))}
      </div>
      <p className="imagery-note">Projected maps are model extrapolations of the trend — not observations and not a guaranteed future.</p>

      <div className="badge-row" style={{ margin: '10px 0 6px' }}><span className="tag scenario">AI-generated scenario</span></div>
      <p className="imagery-note">Scenario image generation is <b>off by default</b> (configs/model.yaml → scenario_image.enabled). When enabled, lower/median/upper variants are labeled “AI-generated scenario — not an observation” and are strictly illustrative.</p>
    </div>
  )
}
