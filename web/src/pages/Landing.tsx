import { useEffect, useMemo, useRef, useState } from 'react'
import '../styles/landing.css'

type ImgSource = { src: string; alt: string; caption?: string; credit?: string; creditHref?: string }
type MultiImgProps = { sources: string[]; alt: string; className?: string; loading?: 'lazy' | 'eager' }

function SafeImg({ sources, alt, className, loading = 'lazy' }: MultiImgProps) {
  const [idx, setIdx] = useState(0)
  const src = sources[idx]
  if (!src) {
    return (
      <div className={`img-fallback ${className ?? ''}`} role="img" aria-label={alt}>
        <span>{alt}</span>
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading={loading}
      decoding="async"
      onError={() => setIdx((i) => i + 1)}
    />
  )
}

const NAV = [
  { href: '#about', label: 'About' },
  { href: '#observe', label: 'Observation' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#regions', label: 'Regions' },
  { href: '#signals', label: 'Signals' },
  { href: '#variables', label: 'Variables' },
  { href: '#methods', label: 'Methods' },
  { href: '#sources', label: 'Data sources' },
  { href: '#imagery', label: 'Imagery' },
  { href: '#transparency', label: 'Transparency' },
]

function scrollToId(id: string) {
  const el = document.querySelector(id)
  if (!el) return
  const navH = 72
  const y = el.getBoundingClientRect().top + window.scrollY - navH
  window.scrollTo({ top: y, behavior: 'smooth' })
}

function useReveal() {
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const els = Array.from(document.querySelectorAll<HTMLElement>('.reveal'))
    if (reduce) { els.forEach((el) => el.classList.add('in')); return }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) }
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' })
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])
}

function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  return <div className={`reveal ${className}`} style={{ ['--d' as any]: `${delay}ms` }}>{children}</div>
}

function SignalViz() {
  const [showTrend, setShowTrend] = useState(true)
  const [showAnomaly, setShowAnomaly] = useState(true)
  const [showForecast, setShowForecast] = useState(true)
  const w = 720, h = 320, pad = 42
  const xs = (i: number) => pad + (i / 23) * (w - pad * 2)
  const ys = (v: number) => h - pad - ((v - 10) / 18) * (h - pad * 2)
  const hist = [12.2,12.6,12.1,12.8,13.0,12.7,13.4,13.1,13.6,13.8,13.5,14.1,13.9,14.4,14.0,14.8,14.3,15.2,14.7,15.5]
  const forecast = [15.6,15.9,16.1,16.4]
  const upper = [16.2,16.8,17.3,17.9]
  const lower = [15.0,15.0,14.9,14.9]
  const line = (vals: number[], off = 0) => vals.map((v, i) => `${i + off === 0 ? 'M' : 'L'} ${xs(i + off)} ${ys(v)}`).join(' ')
  const area = upper.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xs(i + 20)} ${ys(v)}`).join(' ') + ' ' + [...lower].reverse().map((v, i) => `L ${xs(23 - i)} ${ys(v)}`).join(' ') + ' Z'
  const trend = `M ${xs(0)} ${ys(12.4)} L ${xs(23)} ${ys(16.3)}`
  const anomalyI = 17
  return (
    <section className="section" id="signals" aria-labelledby="signals-title">
      <div className="section-inner">
        <Reveal><div className="eyebrow">Reading the Signals</div></Reveal>
        <Reveal delay={60}><h2 id="signals-title">How an environmental time series is interpreted</h2></Reveal>
        <Reveal delay={100}><p className="section-lead">This illustrative example shows how observations can be read together with a trend estimate, an unusual event, and a forecast range. It is a teaching visual—not Earth Pulse output and not NASA observations.</p></Reveal>
        <div className="signal-lab">
          <Reveal delay={140} className="signal-panel">
            <div className="signal-head">
              <h3>Illustrative environmental signal (labeled example)</h3>
              <span className="signal-badge">Illustrative explanation only</span>
            </div>
            <svg className="signal-svg" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Illustrative chart showing historical observations, a trend line, an anomaly point, and a forecast with uncertainty bands">
              <defs>
                <linearGradient id="bandFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.06" />
                </linearGradient>
              </defs>
              {[12,14,16,18,20,22,24,26,28].map((v) => (
                <g key={v}>
                  <line x1={pad} x2={w-pad} y1={ys(v)} y2={ys(v)} stroke="var(--border)" strokeWidth="1" />
                  <text x={8} y={ys(v)+4} fontSize="10" fill="var(--text-muted)">{v}</text>
                </g>
              ))}
              <line x1={xs(19.5)} x2={xs(19.5)} y1={pad} y2={h-pad} stroke="var(--border)" strokeDasharray="4 4" />
              <text x={xs(19.5)-42} y={pad-10} fontSize="10" fill="var(--text-muted)">Observed</text>
              <text x={xs(19.5)+8} y={pad-10} fontSize="10" fill="var(--text-muted)">Forecast horizon</text>
              {showForecast && <path d={area} fill="url(#bandFill)" stroke="none" />}
              <path d={line(hist)} fill="none" stroke="var(--text)" strokeWidth="2.4" />
              {showForecast && <path d={line(forecast, 20).replace('M','L')} fill="none" stroke="var(--accent-strong)" strokeWidth="2.4" strokeDasharray="6 4" />}
              {showTrend && <path d={trend} fill="none" stroke="#c2410c" strokeWidth="2" strokeDasharray="5 5" />}
              {showAnomaly && (
                <g>
                  <circle cx={xs(anomalyI)} cy={ys(hist[anomalyI])} r="6" fill="#b91c1c" />
                  <text x={xs(anomalyI)+8} y={ys(hist[anomalyI])-10} fontSize="11" fill="#b91c1c" fontWeight="700">Anomaly</text>
                </g>
              )}
              {showForecast && (
                <g fill="var(--text-muted)" fontSize="10">
                  <text x={xs(21)} y={ys(upper[1])-6}>p90</text>
                  <text x={xs(21)} y={ys(lower[1])+14}>p10</text>
                  <text x={xs(21)} y={ys(forecast[1])-6} fill="var(--accent-strong)">p50</text>
                </g>
              )}
              <text x={w/2-40} y={h-8} fontSize="11" fill="var(--text-muted)">Time (illustrative months/years)</text>
            </svg>
            <div className="signal-controls" role="group" aria-label="Toggle chart elements">
              <button className="pill-btn" aria-pressed={showTrend} onClick={() => setShowTrend(v=>!v)}>Trend line</button>
              <button className="pill-btn" aria-pressed={showAnomaly} onClick={() => setShowAnomaly(v=>!v)}>Anomaly marker</button>
              <button className="pill-btn" aria-pressed={showForecast} onClick={() => setShowForecast(v=>!v)}>Forecast & uncertainty</button>
            </div>
          </Reveal>
          <Reveal delay={180} className="signal-legend">
            <h3>What each element means</h3>
            <ul>
              <li><b>Historical observations:</b> measured or recorded values over time (subject to source coverage and quality).</li>
              <li><b>Trend line:</b> an estimate of long-term direction/magnitude (e.g. robust slope) that helps summarize gradual change.</li>
              <li><b>Anomaly:</b> a value that departs unusually from local/expected behavior under a chosen detection method and window.</li>
              <li><b>Forecast (p50):</b> a model-derived central estimate for future steps, not a guarantee.</li>
              <li><b>Uncertainty band (p10–p90):</b> a plausible range reflecting model and variability uncertainty; wider bands indicate lower certainty.</li>
            </ul>
            <p className="var-note">All values shown here are illustrative labels for explanation. Earth Pulse reports actual computed results per location with provenance and coverage notes in the application.</p>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

function MethodDiagram({ kind }: { kind: 'theil' | 'mk' | 'anomaly' | 'forecast' | 'twins' | 'opposite' }) {
  const common = { className: 'mini-diagram', viewBox: '0 0 320 120', role: 'img' as const }
  if (kind === 'theil') return (
    <svg {...common} aria-label="Illustration of a robust trend line through scattered points">
      <rect width="320" height="120" fill="transparent" />
      {[ [30,85],[60,78],[90,82],[120,70],[150,74],[180,60],[210,66],[240,52],[270,58],[295,45] ].map((p,i)=><circle key={i} cx={p[0]} cy={p[1]} r="4" fill="var(--text-muted)" />)}
      <line x1="20" y1="90" x2="300" y2="40" stroke="#c2410c" strokeWidth="3" />
      <text x="200" y="32" fontSize="11" fill="#c2410c" fontWeight="700">Robust slope</text>
    </svg>
  )
  if (kind === 'mk') return (
    <svg {...common} aria-label="Illustration of monotonic trend direction and significance concept">
      <polyline points="20,90 70,80 120,75 170,60 220,55 270,40 300,35" fill="none" stroke="var(--accent-strong)" strokeWidth="3" />
      <text x="24" y="24" fontSize="11" fill="var(--text)">Consistent direction over time</text>
      <text x="24" y="40" fontSize="10" fill="var(--text-muted)">Significance test evaluates evidence for a monotonic trend</text>
      <circle cx="300" cy="35" r="5" fill="var(--accent)" />
    </svg>
  )
  if (kind === 'anomaly') return (
    <svg {...common} aria-label="Illustration of an unusual observation above typical variation">
      <polyline points="20,70 60,72 100,68 140,71 180,30 220,69 260,73 300,70" fill="none" stroke="var(--text)" strokeWidth="2.5" />
      <rect x="20" y="58" width="280" height="24" fill="var(--accent)" opacity="0.12" />
      <circle cx="180" cy="30" r="6" fill="#b91c1c" />
      <text x="190" y="26" fontSize="11" fill="#b91c1c" fontWeight="700">Unusual point</text>
      <text x="24" y="112" fontSize="10" fill="var(--text-muted)">Departure relative to local/rolling behavior</text>
    </svg>
  )
  if (kind === 'forecast') return (
    <svg {...common} aria-label="Illustration of forecast with uncertainty band">
      <path d="M170,70 L210,62 L250,58 L290,52 L290,78 L250,76 L210,74 L170,70 Z" fill="var(--accent)" opacity="0.2" />
      <polyline points="20,80 60,76 100,74 140,70 170,70" fill="none" stroke="var(--text)" strokeWidth="2.5" />
      <polyline points="170,70 210,68 250,66 290,65" fill="none" stroke="var(--accent-strong)" strokeWidth="2.5" strokeDasharray="6 4" />
      <line x1="170" y1="20" x2="170" y2="105" stroke="var(--border)" strokeDasharray="4 4" />
      <text x="178" y="34" fontSize="10" fill="var(--text-muted)">Forecast range (p10–p90)</text>
    </svg>
  )
  if (kind === 'twins') return (
    <svg {...common} aria-label="Illustration of grouping similar locations">
      {[ [70,45],[90,55],[80,70],[105,50] ].map((p,i)=><circle key={'a'+i} cx={p[0]} cy={p[1]} r="5" fill="var(--accent)" />)}
      {[ [220,40],[235,55],[250,45],[240,70] ].map((p,i)=><circle key={'b'+i} cx={p[0]} cy={p[1]} r="5" fill="#c2410c" />)}
      <ellipse cx="88" cy="55" rx="38" ry="28" fill="none" stroke="var(--accent)" strokeDasharray="4 4" />
      <ellipse cx="236" cy="52" rx="36" ry="28" fill="none" stroke="#c2410c" strokeDasharray="4 4" />
      <text x="52" y="100" fontSize="10" fill="var(--text-muted)">Similar environmental signatures</text>
    </svg>
  )
  return (
    <svg {...common} aria-label="Illustration of opposite trend directions in neighboring areas">
      <rect x="40" y="35" width="90" height="50" rx="8" fill="color-mix(in srgb, #15803d 18%, transparent)" stroke="#15803d" />
      <rect x="190" y="35" width="90" height="50" rx="8" fill="color-mix(in srgb, #c2410c 18%, transparent)" stroke="#c2410c" />
      <path d="M60,70 L110,45" stroke="#15803d" strokeWidth="3" />
      <path d="M210,45 L260,70" stroke="#c2410c" strokeWidth="3" />
      <text x="52" y="102" fontSize="10" fill="var(--text-muted)">Neighboring areas can diverge</text>
    </svg>
  )
}

export default function Landing() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('ep-theme')
    if (saved === 'light' || saved === 'dark') return saved
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  const [active, setActive] = useState('#top')
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [showTop, setShowTop] = useState(false)

  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('ep-theme', theme) }, [theme])
  useEffect(() => { document.title = 'Earth Pulse — Discover the Signals' }, [])
  useReveal()

  useEffect(() => {
    const ids = ['top','about','observe','how-it-works','regions','signals','variables','methods','sources','imagery','transparency','launch']
    const sections = ids.map(id => document.getElementById(id)).filter(Boolean) as HTMLElement[]
    const onScroll = () => {
      setScrolled(window.scrollY > 8)
      setShowTop(window.scrollY > 500)
      let current = 'top'
      for (const s of sections) {
        const r = s.getBoundingClientRect()
        if (r.top <= 120 && r.bottom >= 120) { current = `#${s.id}`; break }
      }
      setActive(current)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Verified NASA Image and Video Library assets (checked) + fallbacks where helpful
  const heroImg = ['https://images-assets.nasa.gov/image/PIA18033/PIA18033~orig.jpg', 'https://images-assets.nasa.gov/image/PIA00123/PIA00123~orig.jpg']
  const eoImg = ['https://images-assets.nasa.gov/image/PIA03377/PIA03377~orig.jpg', 'https://images-assets.nasa.gov/image/PIA00123/PIA00123~orig.jpg']
  const regionImgs = {
    western: ['https://images-assets.nasa.gov/image/iss036e022303/iss036e022303~orig.jpg', 'https://images-assets.nasa.gov/image/PIA03434/PIA03434~orig.jpg'],
    northChina: ['https://images-assets.nasa.gov/image/PIA12063/PIA12063~orig.jpg', 'https://images-assets.nasa.gov/image/PIA02688/PIA02688~orig.jpg'],
    california: ['https://images-assets.nasa.gov/image/PIA11066/PIA11066~orig.jpg', 'https://images-assets.nasa.gov/image/PIA22465/PIA22465~orig.jpg'],
  }

  const sources = useMemo(() => ([
    { status: 'integrated', label: 'Currently integrated', cls: 'status-integrated', rows: [
      { name: 'NASA POWER (project API)', provides: 'Point-based monthly climate parameters (e.g. temperature, precipitation, humidity, wind, solar radiation) for long historical spans where available.', use: 'Core real-data source in the point/high-resolution flow and documented real-store path; bundled demo can run offline with synthetic data.', link: 'https://power.larc.nasa.gov/', attr: 'NASA POWER Project. Cite per POWER terms when using real outputs.' },
      { name: 'NASA GIBS / Worldview imagery services', provides: 'Global satellite imagery tiles/layers (e.g. MODIS-based views) for map context and past imagery references.', use: 'Used for imagery tile/thumbnails in the application’s past imagery and map-layer experiences (where enabled/configured).', link: 'https://worldview.earthdata.nasa.gov/', attr: 'NASA GIBS/Worldview imagery; follow NASA imagery and GIBS usage guidance.' },
      { name: 'Microsoft Planetary Computer (Sentinel-2) — point flow integration', provides: 'Sentinel-2 L2A scenes and band data enabling higher-resolution NDVI/imagery context for selected locations (availability-dependent).', use: 'Integrated in the high-resolution point store build path for recent-period vegetation/imagery context (no login in that path, subject to service availability).', link: 'https://planetarycomputer.microsoft.com/', attr: 'Sentinel data via Copernicus/ESA; accessed through Planetary Computer STAC/services.' },
    ]},
    { status: 'optional', label: 'Optional or on-demand', cls: 'status-optional', rows: [
      { name: 'NASA FIRMS', provides: 'Near-real-time active fire / thermal anomaly detections.', use: 'Optional event/anomaly signal when configured (e.g. API key present); not required for core demo.', link: 'https://firms.modaps.eosdis.nasa.gov/', attr: 'NASA FIRMS; API key/terms apply for live access.' },
      { name: 'NASA Earthdata / CMR-backed discovery (Tier B hooks)', provides: 'Discovery and access pathways to NASA DAAC products via Earthdata services.', use: 'Bounded, opt-in on-demand discovery/cache paths in the API; not required for Tier A precomputed demo responses.', link: 'https://search.earthdata.nasa.gov/', attr: 'NASA Earthdata; free Earthdata Login may be required for some products.' },
      { name: 'MODIS / GPM / other DAAC products (pipeline fetch modules)', provides: 'Gridded vegetation, precipitation, temperature and related Earth observation products depending on module and credentials.', use: 'Supported as pipeline/on-demand fetch targets in codebase; availability depends on configuration, credentials, and network.', link: 'https://www.earthdata.nasa.gov/', attr: 'Cite specific NASA products/DAACs used in any real analysis.' },
    ]},
    { status: 'external', label: 'External scientific resources', cls: 'status-external', rows: [
      { name: 'NASA Giovanni', provides: 'Interactive analysis and visualization of many Earth science variables for validation and exploration.', use: 'External scientific reference/tool; not embedded as a direct runtime dependency.', link: 'https://giovanni.gsfc.nasa.gov/', attr: 'NASA GES DISC Giovanni.' },
      { name: 'NASA AppEEARS', provides: 'Point/area extraction and subsetting for selected NASA products.', use: 'External resource for data access workflows; referenced in project context.', link: 'https://appeears.earthdatacloud.nasa.gov/', attr: 'NASA LP DAAC AppEEARS.' },
      { name: 'NASA Hydrology Time Series (where applicable)', provides: 'Hydrology-related time-series resources in the NASA ecosystem.', use: 'External scientific resource; verify product-specific applicability before use.', link: 'https://www.earthdata.nasa.gov/', attr: 'NASA Earthdata (product-specific terms apply).' },
      { name: 'NOAA Climate Data Online', provides: 'Historical weather and climate records from NOAA archives.', use: 'External complementary data source; not claimed as integrated by default.', link: 'https://www.ncei.noaa.gov/cdo-web/', attr: 'NOAA NCEI.' },
      { name: 'KNMI Climate Explorer', provides: 'Climate data exploration, indices, and statistical tools.', use: 'External analysis/reference resource; not a direct application integration.', link: 'https://climexp.knmi.nl/', attr: 'KNMI Climate Explorer.' },
    ]},
    { status: 'planned', label: 'Planned integrations', cls: 'status-planned', rows: [
      { name: 'Broader real-product coverage in default demo stores', provides: 'More parameters/regions backed by real observations out-of-the-box.', use: 'Planned/expandable via existing pipeline and configuration; current bundled quickstart prioritizes offline reproducibility.', link: 'https://github.com/cyberhatc/earth-pulse', attr: 'Repository roadmap context; see docs for current status.' },
      { name: 'Additional partner datasets and automated ingest presets', provides: 'Richer multi-source comparisons and easier real-data setup.', use: 'Potential future integrations; depends on credentials, quotas, and implementation work.', link: 'https://www.earthdata.nasa.gov/', attr: 'Source-specific terms apply.' },
    ]},
  ]), [])

  const gallery = [
    { wide: true, tall: false, sources: ['https://images-assets.nasa.gov/image/PIA03377/PIA03377~orig.jpg','https://images-assets.nasa.gov/image/PIA00123/PIA00123~orig.jpg'], alt: 'Blue Marble global view of Earth showing land, oceans, clouds, and ice', title: 'Global Earth observation', caption: 'A whole-Earth perspective supports understanding coupled land, ocean, atmosphere, and ice systems.', credit: 'NASA Image and Video Library', href: 'https://images.nasa.gov/details/PIA03377' },
    { wide: false, tall: true, sources: ['https://images-assets.nasa.gov/image/GSFC_20171208_Archive_e001963/GSFC_20171208_Archive_e001963~orig.jpg','https://images-assets.nasa.gov/image/PIA19937/PIA19937~orig.jpg'], alt: 'Satellite view highlighting vegetation and land cover patterns', title: 'Vegetation and land cover', caption: 'Vegetation indices and optical imagery help reveal greenness patterns and land-surface change over time.', credit: 'NASA / GSFC (NASA Image and Video Library)', href: 'https://images.nasa.gov/details/GSFC_20171208_Archive_e001963' },
    { wide: false, tall: false, sources: ['https://images-assets.nasa.gov/image/PIA02688/PIA02688~orig.jpg','https://images-assets.nasa.gov/image/PIA03434/PIA03434~orig.jpg'], alt: 'Satellite view of ocean color and coastal waters', title: 'Ocean and sea-surface conditions', caption: 'Ocean observations inform sea-surface conditions, circulation context, and coastal–marine interactions.', credit: 'NASA Image and Video Library', href: 'https://images.nasa.gov/details/PIA02688' },
    { wide: false, tall: false, sources: ['https://images-assets.nasa.gov/image/GSFC_20171208_Archive_e000975/GSFC_20171208_Archive_e000975~orig.jpg','https://images-assets.nasa.gov/image/GSFC_20171208_Archive_e002131/GSFC_20171208_Archive_e002131~orig.jpg'], alt: 'Satellite view of atmospheric cloud and precipitation systems', title: 'Precipitation and atmosphere', caption: 'Atmospheric observations support analysis of storms, moisture, and precipitation-related variability.', credit: 'NASA / GSFC (NASA Image and Video Library)', href: 'https://images.nasa.gov/details/GSFC_20171208_Archive_e000975' },
    { wide: true, tall: false, sources: ['https://images-assets.nasa.gov/image/PIA12063/PIA12063~orig.jpg','https://images-assets.nasa.gov/image/PIA22465/PIA22465~orig.jpg'], alt: 'Coastal and land-use patterns viewed from satellite imagery', title: 'Coastal change and land use', caption: 'Satellite imagery provides context for coastal interfaces, development patterns, and landscape transitions.', credit: 'NASA Image and Video Library', href: 'https://images.nasa.gov/details/PIA12063' },
    { wide: false, tall: false, sources: ['https://images-assets.nasa.gov/image/iss036e022303/iss036e022303~orig.jpg','https://images-assets.nasa.gov/image/PIA11066/PIA11066~orig.jpg'], alt: 'Earth observation image captured from orbit showing regional geography', title: 'Orbital Earth observation', caption: 'Orbital platforms capture multi-scale views used to investigate regional environmental systems.', credit: 'NASA Image and Video Library (ISS/NASA)', href: 'https://images.nasa.gov/details/iss036e022303' },
  ]

  return (
    <div className="landing">
      <header className={`landing-nav ${scrolled ? 'scrolled' : ''}`} role="banner">
        <a className="landing-brand" href="/" data-nav aria-label="Earth Pulse home" onClick={() => setMenuOpen(false)}>
          <svg width="30" height="30" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="14" fill="var(--accent)" /><path d="M8 33 h12 l4 -10 l5 18 l5 -13 l4 6 H56" fill="none" stroke="var(--on-accent)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <span>Earth Pulse</span>
        </a>
        <button className="icon-btn nav-toggle" aria-expanded={menuOpen} aria-label="Toggle navigation" onClick={() => setMenuOpen(v=>!v)}>☰</button>
        <nav className={`landing-nav-links ${menuOpen ? 'open' : ''}`} aria-label="Landing sections">
          {NAV.map((item) => (
            <a key={item.href} href={item.href} className={`nav-link ${active === item.href ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setMenuOpen(false); scrollToId(item.href) }}>{item.label}</a>
          ))}
          <button className="icon-btn" onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))} aria-label="Toggle theme" title="Toggle theme">{theme === 'dark' ? '☀' : '☾'}</button>
          <a className="btn-primary landing-nav-cta" href="/app" data-nav onClick={() => setMenuOpen(false)}>Explore Earth Pulse</a>
        </nav>
      </header>

      <main>
        <section className="section hero section-inner" id="top" aria-labelledby="hero-title" style={{maxWidth: 1200, margin: '0 auto'}}>
          <div className="hero-bg-glow" aria-hidden="true" />
          <div className="hero-bg-orbit" aria-hidden="true" />
          <div className="hero-copy">
            <div className="eyebrow hero-enter" style={{['--d' as any]:'40ms'}}>Earth observation · trends · evidence</div>
            <h1 id="hero-title" className="hero-enter" style={{['--d' as any]:'120ms'}}>Discover the Signals.<br /><span className="accent">Understand Earth&apos;s Changing Systems.</span></h1>
            <p className="hero-sub hero-enter" style={{['--d' as any]:'220ms'}}>Explore environmental trends, investigate regional differences and uncover what is changing across our planet through Earth observation data. Earth Pulse brings time series, robust statistics, forecasts with uncertainty, anomalies, and imagery context into one investigation workflow.</p>
            <div className="hero-actions hero-enter" style={{['--d' as any]:'320ms'}}>
              <a className="btn-primary" href="/app" data-nav>Explore Earth Pulse</a>
              <a className="btn-secondary" href="#how-it-works" onClick={(e) => { e.preventDefault(); scrollToId('#how-it-works') }}>How It Works</a>
            </div>
            <div className="hero-meta hero-enter" style={{['--d' as any]:'420ms'}} aria-label="Product highlights">
              <div className="meta-card"><b>Place-based investigation</b><span>Inspect past observations, trends, and forecasts for selected locations.</span></div>
              <div className="meta-card"><b>Statistical rigor</b><span>Theil–Sen trends, Mann–Kendall significance, and uncertainty-aware outputs.</span></div>
              <div className="meta-card"><b>Transparent coverage</b><span>Clear labeling for observed data, forecasts, scenarios, and synthetic demo stores.</span></div>
            </div>
          </div>
          <div className="hero-visual hero-enter" style={{['--d' as any]:'260ms'}} aria-label="Earth imagery hero">
            <div className="grid-overlay" aria-hidden="true" />
            <div className="hero-coords">OBS MODE · GLOBAL · EARTH SYSTEMS</div>
            <div className="media-frame"><SafeImg loading="eager" sources={heroImg} alt="NASA Blue Marble view of Earth showing global land, ocean, cloud, and ice patterns" /></div>
            <div className="hero-visual-caption">
              <b>Investigate change with context.</b> Earth Pulse connects environmental signals across time and space—supporting comparison, interpretation, and careful communication of uncertainty.
              <span className="caption-meta">Imagery: NASA Blue Marble (PIA18033). Credit: NASA. <a href="https://images.nasa.gov/details/PIA18033" target="_blank" rel="noreferrer" style={{color:'#9ff3e6'}}>Source</a></span>
            </div>
          </div>
        </section>

        <section className="section" id="about" aria-labelledby="about-title">
          <div className="section-inner about-grid">
            <div className="prose">
              <Reveal><div className="eyebrow">About Earth Pulse</div></Reveal>
              <Reveal delay={40}><h2 id="about-title">A focused environment for investigating Earth-system signals</h2></Reveal>
              <Reveal delay={80}><p className="section-lead">Earth Pulse is an open-source, map-first explorer for examining how environmental conditions vary over time and differ across regions—using Earth observation data, statistical analysis, and transparent presentation.</p></Reveal>
              <Reveal delay={120}><p><strong>What it is:</strong> a place-based investigation interface where users can explore historical series, detect trends, review anomalies, compare neighboring behaviors, and view probabilistic forecasts alongside imagery and provenance context.</p></Reveal>
              <Reveal delay={150}><p><strong>Why change matters:</strong> Earth-system changes—warming, shifting precipitation, vegetation dynamics, ocean conditions, and more—affect ecosystems, infrastructure, and communities. Understanding direction, magnitude, and confidence is essential for responsible interpretation.</p></Reveal>
              <Reveal delay={180}><p><strong>Why trends differ geographically:</strong> climate drivers, land cover, elevation, coastal influence, water availability, and human land use can produce different (and sometimes opposing) trends even across nearby areas.</p></Reveal>
              <Reveal delay={210}><p><strong>Why statistical significance matters:</strong> not every apparent slope reflects a robust signal. Earth Pulse pairs trend estimates with significance testing so users can distinguish stronger evidence from uncertain or noisy patterns.</p></Reveal>
              <Reveal delay={240}><div className="pull-quote">Earth Pulse is designed to help users move from “something looks different” to “here is what the data shows, how confident we are, and where coverage is limited.”</div></Reveal>
            </div>
            <aside className="fact-stack" aria-label="Key principles">
              {[
                ['Evidence over assumption','Combines visual exploration with quantitative methods and explicit uncertainty bands for forecasts.'],
                ['Regional contrast, not averages only','Supports comparison-oriented views, including detection of neighboring areas with opposite trend directions.'],
                ['Honest data communication','Separates observed data, forecasts, and scenario/illustrative outputs; flags synthetic demo stores and coverage gaps.'],
                ['Built for investigation','Search or click a location, review variables and methods, and interpret results with documented context.'],
              ].map((f,i)=>(<Reveal key={f[0]} delay={100+i*60}><div className="fact"><h3>{f[0]}</h3><p>{f[1]}</p></div></Reveal>))}
            </aside>
          </div>
        </section>

        <section className="section" id="observe" aria-labelledby="observe-title">
          <div className="section-inner">
            <Reveal><div className="eyebrow">Earth observation context</div></Reveal>
            <Reveal delay={40}><h2 id="observe-title">How satellites help us observe changing Earth systems</h2></Reveal>
            <Reveal delay={80}><p className="section-lead">Satellite platforms and Earth-observation products provide repeated, spatially broad views of land, ocean, atmosphere, and vegetation. Earth Pulse uses these perspectives—together with statistical analysis—to support investigation of environmental signals over time.</p></Reveal>
            <div className="eo-band">
              <Reveal delay={120} className="eo-visual">
                <div className="media-frame"><SafeImg sources={eoImg} alt="NASA Blue Marble Earth observation image showing continents, oceans, and cloud systems" /></div>
                <div className="eo-overlay" aria-label="Observation domains">
                  <div className="eo-tag"><b>Land</b>Surface temperature, vegetation condition, land cover context</div>
                  <div className="eo-tag"><b>Ocean</b>Sea-surface conditions and coastal–marine interfaces</div>
                  <div className="eo-tag"><b>Atmosphere</b>Clouds, moisture, winds, precipitation-related signals</div>
                  <div className="eo-tag"><b>Vegetation</b>Greenness dynamics and seasonal ecosystem response</div>
                </div>
              </Reveal>
              <div className="eo-notes">
                <Reveal delay={160}><div className="eo-note"><h3>Repeated observations</h3><p>Consistent revisit cycles enable time-series analysis, helping distinguish short-term variability from longer-term trends where data coverage permits.</p></div></Reveal>
                <Reveal delay={200}><div className="eo-note"><h3>Multi-domain context</h3><p>Environmental change often spans domains—e.g. precipitation, vegetation response, and coastal conditions—so interpretation benefits from combined evidence.</p></div></Reveal>
                <Reveal delay={240}><div className="eo-note"><h3>From imagery to evidence</h3><p>Visual context and quantitative records are complementary: imagery aids interpretation, while statistical methods and uncertainty estimates support careful conclusions.</p></div></Reveal>
                <p className="var-note">Explanatory visual only (not a live satellite dashboard). Imagery credit: NASA Blue Marble / NASA Image and Video Library.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="how-it-works" aria-labelledby="how-title">
          <div className="section-inner">
            <Reveal><div className="eyebrow">How it works</div></Reveal>
            <Reveal delay={40}><h2 id="how-title">A clear workflow for environmental investigation</h2></Reveal>
            <Reveal delay={80}><p className="section-lead">Earth Pulse guides users from question to evidence: select a place, examine available observations, quantify trends, assess significance, and interpret forecasts and contrasts with transparent limitations.</p></Reveal>
            <div className="steps">
              {[
                ['01','Discover environmental variables','Review the parameters available for the selected location and mode (e.g. temperature, precipitation, vegetation indices, humidity, wind, solar radiation, and ocean-related variables where relevant).'],
                ['02','Select a geographical region','Click on the map or search for a place to anchor the analysis to a specific location or nearest analysis cell.'],
                ['03','Explore historical observations','Inspect monthly time series and available imagery/context to understand past behavior, seasonality, and notable events.'],
                ['04','Detect and quantify trends','Estimate long-term trend direction and magnitude using robust methods designed to reduce sensitivity to outliers.'],
                ['05','Evaluate statistical significance','Assess whether detected trends are likely monotonic signals using formal significance testing rather than visual impression alone.'],
                ['06','Compare environmental changes','Examine neighboring contrasts (opposite trends), climate similarity context, and anomalies to understand spatial differences.'],
                ['07','Understand the findings','Read plain-language summaries alongside coverage notes, uncertainty intervals, and labels distinguishing observations, forecasts, and illustrative outputs.'],
              ].map(([num,title,text],i)=>(<Reveal key={num} delay={100+i*40}><article className="step"><div className="step-num">{num}</div><h3>{title}</h3><p>{text}</p></article></Reveal>))}
            </div>
            <Reveal delay={120}><p className="var-note" style={{marginTop: 18}}>Note: the application includes map, charts, imagery, and analysis panels in the live explorer. This landing page does not embed fabricated screenshots; launch the app to view the actual interface and outputs for a selected location.</p></Reveal>
          </div>
        </section>

        <section className="section" id="regions" aria-labelledby="regions-title">
          <div className="section-inner">
            <Reveal><div className="eyebrow">Study regions</div></Reveal>
            <Reveal delay={40}><h2 id="regions-title">Explore three contrasting geographical contexts</h2></Reveal>
            <Reveal delay={80}><p className="section-lead">These regions illustrate how coastal, monsoon-influenced, continental, and Mediterranean-climate environments can present different environmental questions. The descriptions below provide geographic and investigative context only—no trend findings are claimed here.</p></Reveal>
            <div className="region-list">
              <Reveal delay={120}><article className="region">
                <div className="region-media">
                  <span className="region-badge">Region 01</span>
                  <span className="region-coord-chip">8°N–20°N · 70°E–78°E</span>
                  <div className="media-frame"><SafeImg sources={regionImgs.western} alt="Orbital Earth observation image representing the Western Ghats and Arabian Sea region context" /></div>
                </div>
                <div className="region-body">
                  <h3>Western Ghats + Arabian Sea, India</h3>
                  <div className="region-coords">Bounding box: 8°N–20°N, 70°E–78°E</div>
                  <p>A steep, biodiversity-rich mountain range along India’s western margin adjacent to the Arabian Sea, with strong monsoon influence, complex orography, and varied land cover from forests to agricultural and urban areas.</p>
                  <p><strong>Environmental context:</strong> Seasonal rainfall gradients, coastal–inland contrasts, and elevation effects can shape temperature, moisture, and vegetation signals across short distances.</p>
                  <div className="region-meta">
                    <div><b>Landscape</b><span>Escarpments, tropical forests, plateaus, river basins, and coastal plains</span></div>
                    <div><b>Potential variables to investigate</b><span>Precipitation, temperature, humidity, NDVI/vegetation condition, wind, and nearby sea-surface conditions where relevant</span></div>
                  </div>
                </div>
              </article></Reveal>

              <Reveal delay={160}><article className="region">
                <div className="region-media">
                  <span className="region-badge">Region 02</span>
                  <span className="region-coord-chip">30°N–42°N · 110°E–125°E</span>
                  <div className="media-frame"><SafeImg sources={regionImgs.northChina} alt="Satellite imagery representing the North China Plain and Bohai/Yellow Sea coastal context" /></div>
                </div>
                <div className="region-body">
                  <h3>North China Plain + Bohai/Yellow Sea</h3>
                  <div className="region-coords">Bounding box: 30°N–42°N, 110°E–125°E</div>
                  <p>A broad, densely populated alluvial plain connected to major river systems and bordered by the Bohai and Yellow Seas, encompassing intensive agriculture, urban regions, and coastal–marine interfaces.</p>
                  <p><strong>Environmental context:</strong> Continental seasonality, irrigation and land-use intensity, coastal processes, and atmospheric conditions can interact to produce spatially variable environmental signals.</p>
                  <div className="region-meta">
                    <div><b>Landscape</b><span>Lowland plains, river deltas, megacity corridors, and semi-enclosed seas</span></div>
                    <div><b>Potential variables to investigate</b><span>Temperature, precipitation, humidity, wind, solar radiation, vegetation indices, and coastal/ocean parameters where applicable</span></div>
                  </div>
                </div>
              </article></Reveal>

              <Reveal delay={200}><article className="region">
                <div className="region-media">
                  <span className="region-badge">Region 03</span>
                  <span className="region-coord-chip">32°N–42°N · 122°W–117°W</span>
                  <div className="media-frame"><SafeImg sources={regionImgs.california} alt="Satellite imagery representing the California coastal region and adjacent landscape" /></div>
                </div>
                <div className="region-body">
                  <h3>California Coast</h3>
                  <div className="region-coords">Bounding box: 32°N–42°N, 122°W–117°W</div>
                  <p>A diverse coastal margin spanning Mediterranean-climate zones, upwelling-influenced waters, mountain ranges, valleys, and urbanized shorelines, with strong land–sea contrasts and seasonal variability.</p>
                  <p><strong>Environmental context:</strong> Marine influence, drought and precipitation variability, vegetation responses, and coastal circulation can create distinct local and regional patterns worth careful comparison.</p>
                  <div className="region-meta">
                    <div><b>Landscape</b><span>Pacific coastline, coastal ranges, valleys, chaparral, and agricultural/urban mosaics</span></div>
                    <div><b>Potential variables to investigate</b><span>Temperature, precipitation, humidity, wind, vegetation indices (NDVI), and sea-surface/ocean-related indicators where data are relevant</span></div>
                  </div>
                </div>
              </article></Reveal>
            </div>
            <Reveal delay={120}><p className="var-note">Region imagery uses verified NASA Earth observation assets for geographical context; specific frames may not be limited to the exact bounding box but are selected to represent the relevant environment and observation perspective. No environmental trend findings are implied.</p></Reveal>
          </div>
        </section>

        <SignalViz />

        <section className="section" id="variables" aria-labelledby="vars-title">
          <div className="section-inner">
            <Reveal><div className="eyebrow">Environmental variables</div></Reveal>
            <Reveal delay={40}><h2 id="vars-title">Parameters supported by the application workflows</h2></Reveal>
            <Reveal delay={80}><p className="section-lead">Earth Pulse works with a set of climate and environmental parameters used across its grid and/or point analysis flows. Availability depends on location, data mode, source coverage, and physical relevance (for example, ocean-only vs land-only variables).</p></Reveal>
            <div className="var-grid">
              {[
                ['Atmosphere','Temperature','Surface/air temperature signals used to examine warming/cooling patterns, seasonal cycles, and anomalies over time.'],
                ['Atmosphere','Humidity','Moisture-related atmospheric conditions that influence comfort, evapotranspiration, and regional hydroclimate behavior.'],
                ['Atmosphere','Wind','Near-surface wind characteristics relevant to circulation patterns, coastal dynamics, and local environmental variability.'],
                ['Hydrology','Precipitation','Rainfall amounts and variability used to assess wet/dry periods, trends, and extreme or unusual conditions.'],
                ['Vegetation','NDVI','Normalized Difference Vegetation Index as a proxy for vegetation greenness and condition, where observations are available and relevant.'],
                ['Energy','Solar radiation','Incoming solar energy context that can relate to surface conditions, seasonality, and climate/energy analyses.'],
                ['Ocean','Sea surface temperature','Ocean surface thermal conditions for marine-relevant locations; not applicable or available everywhere in the same way as land parameters.'],
                ['Ocean','Sea level','Sea-level-related signals where supported by the selected data/store; interpreted with coverage and relevance constraints.'],
              ].map((v,i)=>(<Reveal key={v[1]} delay={80+i*30}><div className="var-card"><div className="var-cat">{v[0]}</div><h3>{v[1]}</h3><p>{v[2]}</p></div></Reveal>))}
            </div>
            <Reveal delay={120}><p className="var-note"><strong>Coverage note:</strong> the bundled offline demo uses a deterministic synthetic store with defined variables and masks. Real-data availability, time spans, and spatial/temporal resolution depend on the selected workflow, source products, and configuration. Soil moisture is not presented here as a universally available in-app variable unless supported in the active workflow for a given location.</p></Reveal>
          </div>
        </section>

        <section className="section" id="methods" aria-labelledby="methods-title">
          <div className="section-inner">
            <Reveal><div className="eyebrow">Scientific methodology</div></Reveal>
            <Reveal delay={40}><h2 id="methods-title">Methods implemented for trend, anomaly, and forecast interpretation</h2></Reveal>
            <Reveal delay={80}><p className="section-lead">Earth Pulse combines robust statistics, interpretable baselines, and machine-learning components used in the repository’s analysis/model pipeline. Visuals below are explanatory diagrams (not application outputs). Interpret results with reported uncertainty and data-coverage context.</p></Reveal>
            <div className="method-grid">
              <Reveal delay={100}><article className="method"><MethodDiagram kind="theil" /><h3>Theil–Sen estimator</h3><p>Estimates trend magnitude as a robust slope, reducing sensitivity to outliers compared with ordinary least squares in many cases.</p><ul><li>Supports long-term direction and rate summaries for time series.</li><li>Paired with significance testing for evidence-aware interpretation.</li></ul></article></Reveal>
              <Reveal delay={130}><article className="method"><MethodDiagram kind="mk" /><h3>Mann–Kendall test</h3><p>Evaluates monotonic trend significance in environmental time series.</p><ul><li>Reports significance and trend direction context used by the application.</li><li>Helps distinguish persistent signals from variability/noise where data permit.</li></ul></article></Reveal>
              <Reveal delay={160}><article className="method"><MethodDiagram kind="anomaly" /><h3>Anomaly detection</h3><p>Uses rolling robust statistics (e.g. median/MAD-based z-scores) to flag unusually high/low values, with optional multivariate methods (such as Isolation Forest) in configurable paths.</p><ul><li>Highlights departures that merit closer inspection.</li><li>Interpreted alongside source coverage and series quality.</li></ul></article></Reveal>
              <Reveal delay={190}><article className="method"><MethodDiagram kind="forecast" /><h3>Forecasting with uncertainty</h3><p>Forecast outputs are presented with uncertainty bands (p10/p50/p90). The codebase includes ridge-rollout forecasting and transparent linear-trend+seasonal fallback behavior where applicable.</p><ul><li>Communicates plausible ranges rather than a single certain future.</li><li>Backtesting/validation utilities exist for forecast evaluation workflows.</li></ul></article></Reveal>
              <Reveal delay={220}><article className="method"><MethodDiagram kind="twins" /><h3>Climate Twins (clustering)</h3><p>Groups locations with similar climate/environmental feature signatures (e.g. K-Means-based clustering in precomputed analysis) to provide comparative context.</p><ul><li>Helps users find places with related profiles, not identical outcomes.</li><li>Based on selected features and preprocessing used in the analysis pipeline.</li></ul></article></Reveal>
              <Reveal delay={250}><article className="method"><MethodDiagram kind="opposite" /><h3>Opposite Trend Detector</h3><p>Identifies neighboring grid cells with opposite trend directions for selected parameters (subject to significance/strength criteria) to surface spatial contrasts.</p><ul><li>Useful for investigating local drivers such as land use, terrain, or water management.</li><li>Pairs are ranked/filtered by analysis logic; interpretation remains contextual.</li></ul></article></Reveal>
            </div>
          </div>
        </section>

        <section className="section" id="sources" aria-labelledby="sources-title">
          <div className="section-inner">
            <Reveal><div className="eyebrow">Data sources</div></Reveal>
            <Reveal delay={40}><h2 id="sources-title">Integrated, optional, external, and planned resources</h2></Reveal>
            <Reveal delay={80}><p className="section-lead">The entries below reflect sources and resources evidenced in the repository’s code, configuration, and documentation context. Status varies by mode (offline demo, real pipeline, point flow, optional Tier B). External and planned resources are not implied to be integrated unless stated.</p></Reveal>
            <div className="source-groups">
              {sources.map((g,i)=>(
                <Reveal key={g.status} delay={100+i*40}><div className="source-group">
                  <div className="source-group-head"><h3>{g.label}</h3><span className={`status-pill ${g.cls}`}>{g.status === 'integrated' ? 'Integrated' : g.status === 'optional' ? 'Optional / config-dependent' : g.status === 'external' ? 'External resource' : 'Planned'}</span></div>
                  <div className="source-table-wrap"><table className="source-table"><thead><tr><th>Source</th><th>What it provides</th><th>How Earth Pulse uses it</th><th>Link / attribution</th></tr></thead><tbody>
                    {g.rows.map((r)=>(<tr key={r.name}><td><strong>{r.name}</strong></td><td className="source-desc">{r.provides}</td><td className="source-desc">{r.use}</td><td className="source-desc"><a href={r.link} target="_blank" rel="noreferrer">Official/resource link</a><br />{r.attr}</td></tr>))}
                  </tbody></table></div>
                </div></Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="section" id="imagery" aria-labelledby="gallery-title">
          <div className="section-inner">
            <Reveal><div className="eyebrow">Satellite imagery gallery</div></Reveal>
            <Reveal delay={40}><h2 id="gallery-title">Geographical and Earth-observation imagery for context</h2></Reveal>
            <Reveal delay={80}><p className="section-lead">Editorial gallery using verified NASA imagery for visual orientation. These images provide geographical/observational context; they are not presented as direct, location-specific measurements produced by this app unless explicitly labeled as such inside the application.</p></Reveal>
            <div className="gallery-grid">
              {gallery.map((g,i)=>(
                <Reveal key={g.title} delay={80+i*40}>
                  <figure className={`gallery-item ${g.wide ? 'wide' : ''} ${g.tall ? 'tall' : ''}`}>
                    <div className="media-frame"><SafeImg sources={g.sources} alt={g.alt} /></div>
                    <figcaption><b>{g.title}</b>{g.caption} <a href={g.href} target="_blank" rel="noreferrer">{g.credit}</a></figcaption>
                  </figure>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="section" id="transparency" aria-labelledby="transparency-title">
          <div className="section-inner">
            <Reveal><div className="eyebrow">Data transparency</div></Reveal>
            <Reveal delay={40}><h2 id="transparency-title">Clear distinctions, limitations, and uncertainty</h2></Reveal>
            <Reveal delay={80}><p className="section-lead">Earth Pulse is built to communicate what the data can and cannot support. Users should always interpret outputs together with coverage metadata, method assumptions, and source limitations.</p></Reveal>
            <div className="transparency-grid">
              <Reveal delay={100}><div className="notice warn"><h3>Important: bundled synthetic demo data</h3><p>The default offline/bundled sample store used for quickstart demos is <strong>deterministic synthetic data</strong> generated for reproducible application behavior. It is <strong>not real NASA observation data</strong> and must not be presented as measured historical reality.</p></div></Reveal>
              <Reveal delay={130}><div className="notice"><h3>Observed data vs derived outputs</h3><ul><li><strong>Real observations:</strong> present only when the active workflow/store is built from actual source products and reported as such.</li><li><strong>Forecasts:</strong> model-derived estimates with uncertainty bands (p10/p50/p90), not certainties.</li><li><strong>AI-generated or scenario imagery (if shown):</strong> illustrative outputs labeled separately from observations.</li></ul></div></Reveal>
              <Reveal delay={160}><div className="notice"><h3>Coverage, resolution, and gaps</h3><ul><li>Parameters may be unavailable, masked, or irrelevant by location (e.g. land vs ocean context).</li><li>Historical length and spatial/temporal resolution vary by source and product; no single source provides uniform 1 km, 40-year continuity for every variable.</li><li>The application surfaces coverage/provenance information and gap notes in payloads and UI where applicable.</li></ul></div></Reveal>
              <Reveal delay={190}><div className="notice"><h3>Statistical uncertainty and limitations</h3><ul><li>Trend significance depends on data quality, length, and variability; non-significant trends should be interpreted cautiously.</li><li>Anomalies indicate unusual values relative to chosen methods/windows, not definitive causation.</li><li>Forecast skill and backtest metrics (when available) are context-dependent; results should not be over-interpreted beyond supported evidence.</li></ul></div></Reveal>
            </div>
          </div>
        </section>

        <section className="section final-cta" id="launch" aria-labelledby="cta-title">
          <div className="section-inner">
            <Reveal><div className="eyebrow">Launch the explorer</div></Reveal>
            <Reveal delay={40}><h2 id="cta-title">Start Exploring Earth&apos;s Changing Systems.</h2></Reveal>
            <Reveal delay={80}><p>Investigate environmental variables, discover regional trends and understand the evidence behind Earth&apos;s changing systems.</p></Reveal>
            <Reveal delay={120}><a className="btn-primary" href="/app" data-nav style={{fontSize: '1rem', minHeight: 46, padding: '0 22px'}}>Launch Earth Pulse</a></Reveal>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="section-inner">
          <div>Earth Pulse · Open-source environmental trend explorer. Imagery: NASA Image and Video Library / NASA Earth observation assets as credited (used for contextual illustration).</div>
          <div><a href="/app" data-nav>Open application</a> · <a href="https://github.com/cyberhatc/earth-pulse" target="_blank" rel="noreferrer">GitHub repository</a></div>
        </div>
      </footer>
      <button className={`back-to-top ${showTop ? 'show' : ''}`} aria-label="Back to top" onClick={() => window.scrollTo({top:0, behavior:'smooth'})}>↑</button>
    </div>
  )
}
