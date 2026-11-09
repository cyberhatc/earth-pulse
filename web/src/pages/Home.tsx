import { useCallback, useEffect, useState } from 'react'
import MapView from '../components/MapView'
import PlacePanel from '../components/PlacePanel'
import TimeSlider from '../components/TimeSlider'
import LayerToggles from '../components/LayerToggles'
import { usePlace } from '../hooks/usePlace'
import { getLocale, setLocale, LOCALES, t, type Locale } from '../lib/i18n'

export default function Home() {
  const [selected, setSelected] = useState<{ lat: number; lon: number } | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [sliderYear, setSliderYear] = useState(2025)
  const [lowBandwidth, setLowBandwidth] = useState<boolean>(() => localStorage.getItem('ep-lb') === '1')
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('ep-theme')
    if (saved === 'light' || saved === 'dark') return saved
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  const [locale, setLocaleState] = useState<Locale>(getLocale())
  const [gibsEnabled, setGibsEnabled] = useState<Record<string, boolean>>({ 'gibs-ndvi': false })

  const { data, loading, error, reload } = usePlace(selected?.lat ?? null, selected?.lon ?? null, 60)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('ep-theme', theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem('ep-lb', lowBandwidth ? '1' : '0')
  }, [lowBandwidth])

  const onSelect = useCallback((lat: number, lon: number) => {
    setSelected({ lat, lon })
    setPanelOpen(true)
  }, [])

  const toggleLayer = useCallback((id: string) => {
    setGibsEnabled((prev) => ({ ...prev, [id]: !prev[id] }))
  }, [])

  return (
    <div className="app">
      <header className="header">
        <a className="logo" href="#" onClick={(e) => e.preventDefault()} aria-label="Earth Pulse home">
          <svg width="30" height="30" viewBox="0 0 64 64" aria-hidden="true">
            <rect width="64" height="64" rx="14" fill="var(--accent)" />
            <path d="M8 33 h12 l4 -10 l5 18 l5 -13 l4 6 H56" fill="none" stroke="var(--on-accent)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <h1>
            Earth Pulse
            <small>{t('tagline')}</small>
          </h1>
        </a>
        <div className="spacer" />
        <label className="select" aria-label="Language">
          <select className="select" value={locale} onChange={(e) => { const l = e.target.value as Locale; setLocaleState(l); setLocale(l) }}>
            {LOCALES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
        </label>
        <button className="icon-btn" onClick={() => setLowBandwidth((v) => !v)} aria-pressed={lowBandwidth} title="Low-bandwidth mode: hide imagery, charts first">
          {lowBandwidth ? '📶 Low-BW' : '🖼 Full'}
        </button>
        <button className="icon-btn" onClick={() => setTheme((th) => (th === 'dark' ? 'light' : 'dark'))} aria-label="Toggle theme">
          {theme === 'dark' ? '☾' : '☀'}
        </button>
        <a className="icon-btn" href="https://github.com" target="_blank" rel="noreferrer" title="Source on GitHub (MIT)">GitHub</a>
      </header>

      <main className="map-wrap">
        <MapView onSelect={onSelect} selected={selected} gibsEnabled={gibsEnabled} />

        <div className="overlay-card hint" role="status">
          <b>{t('clickHint')}</b>
          <div style={{ marginTop: 4 }}>Past ~40 years where available · forecast with uncertainty · opposite-trend detective cases</div>
        </div>

        <LayerToggles enabled={gibsEnabled} onToggle={toggleLayer} />
        <TimeSlider year={sliderYear} min={1985} max={2035} onChange={setSliderYear} />

        <PlacePanel
          payload={panelOpen ? data : null}
          loading={panelOpen && loading}
          error={panelOpen ? error : null}
          onClose={() => setPanelOpen(false)}
          onRetry={reload}
          lowBandwidth={lowBandwidth}
        />
      </main>

      <footer className="footer">
        <span>🌍 Earth Pulse · NASA Space Apps 2026</span>
        <span>{t('footerCredit')}</span>
        <span>Code MIT · <a href="https://github.com/NASA-Space-Apps-Challenge" target="_blank" rel="noreferrer">challenge</a></span>
        <span>{t('uncertaintyNote')}</span>
      </footer>
    </div>
  )
}
