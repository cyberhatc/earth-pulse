import { GIBS_LAYERS } from '../lib/mapLayers'

interface Props {
  enabled: Record<string, boolean>
  onToggle: (id: string) => void
}

export default function LayerToggles({ enabled, onToggle }: Props) {
  return (
    <div className="overlay-card layer-toggles" aria-label="Map layer toggles">
      <h2>NASA GIBS layers</h2>
      {GIBS_LAYERS.map((l) => (
        <label key={l.id}>
          <input type="checkbox" checked={!!enabled[l.id]} onChange={() => onToggle(l.id)} />
          <span>{l.label}</span>
        </label>
      ))}
      <p className="imagery-note" style={{ margin: 0 }}>Tiles: NASA GIBS · © OpenStreetMap contributors (base)</p>
    </div>
  )
}
