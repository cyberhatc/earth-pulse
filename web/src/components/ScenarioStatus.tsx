import { useState } from 'react'
import type { PlacePayload } from '../types/payload'
import { apiUrl } from '../lib/api'
import { paramLabel } from '../lib/format'

interface ScenarioResponse {
  status: string
  enabled?: boolean
  instruction?: string
  label: string
  usable_months?: number
  conditioning?: {
    delta: number
    source_image_url: string
    cards: Array<{ name: string; prompt: string }>
  }
  cards: Array<{ name: string; prompt: string }>
}

export default function ScenarioStatus({ payload }: { payload: PlacePayload }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [data, setData] = useState<ScenarioResponse | null>(null)
  const [error, setError] = useState('')

  const check = async () => {
    setState('loading')
    setError('')
    try {
      const res = await fetch(apiUrl(`/imagery/scenario?lat=${payload.location.lat}&lon=${payload.location.lon}&parameter=ndvi&horizon_months=60`))
      if (!res.ok) throw new Error(`API ${res.status}`)
      setData((await res.json()) as ScenarioResponse)
      setState('done')
    } catch (e) {
      setError((e as Error).message)
      setState('error')
    }
  }

  return (
    <div className="card" style={{ marginTop: 8 }}>
      <h3>AI scenario pipeline <span className="tag scenario" style={{ marginLeft: 6 }}>Experimental</span></h3>
      <p className="imagery-note">
        Conditioned on the latest real GIBS tile + the model's predicted NDVI delta. Always labelled “AI-generated scenario — not an observation”. Generation runs offline (Colab/Kaggle GPU), never inside the web request.
      </p>
      <button className="icon-btn" onClick={check} disabled={state === 'loading'}>
        {state === 'loading' ? 'Checking…' : 'Check scenario pipeline for this place'}
      </button>
      {state === 'error' && <p className="imagery-note" style={{ color: 'var(--anomaly)' }}>Unavailable: {error}. Is the API reachable?</p>}
      {state === 'done' && data && (
        <div className="imagery-note" style={{ marginTop: 6 }}>
          <div><b>Status:</b> {data.status}{typeof data.enabled === 'boolean' ? ` (enabled: ${String(data.enabled)})` : ''}{typeof data.usable_months === 'number' ? ` · usable history: ${data.usable_months} months` : ''}</div>
          {data.conditioning && (
            <div style={{ marginTop: 4 }}>
              <div><b>Predicted ΔNDVI by horizon:</b> {data.conditioning.delta >= 0 ? '+' : ''}{data.conditioning.delta.toFixed(3)}</div>
              <details style={{ marginTop: 4 }}>
                <summary style={{ cursor: 'pointer' }}>Show the exact prompts (offline, auditable)</summary>
                <ol style={{ fontSize: '0.7rem' }}>
                  {data.conditioning.cards.map((c) => <li key={c.name}><b>{c.name}</b>: {c.prompt}</li>)}
                </ol>
              </details>
              {data.instruction && <div style={{ marginTop: 4 }}><code style={{ fontSize: '0.68rem' }}>{data.instruction}</code></div>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
