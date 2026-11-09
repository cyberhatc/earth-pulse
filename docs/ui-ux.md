# UI/UX — Earth Pulse frontend

**Map-first. One question: “What is happening to this place?”**

## Information architecture
```text
Header (logo · language · theme · low-bandwidth toggle · GitHub link)
└── Map (MapLibre GL, full screen)                ┌── Click → Place Panel ──────────────┐
    · OSM/positron base                           │  Coverage badge (sources/years/gaps) │
    · Time slider (1985→future)                   │  Tabs:                                │
    · Layer toggles (GIBS NDVI/SST/fires…)        │   Overview · Charts (past+forecast)   │
    · Click anywhere → panel                      │   Imagery (past GIBS · projected SVG)  │
                                                  │   Opposite Trends (case files)         │
                                                  │   Why (plain-English explainer)        │
                                                  │  Watchlist ★ (localStorage)          │
                                                  └─────────────────────────────────────┘
Footer (NASA Earthdata citation · license · challenge credit)
```

## Layout & components
- **Full-bleed map** (MapLibre GL JS). Right **slide-over panel** on desktop; **bottom sheet** on mobile. Undoable click (click empty ocean → panel closes).
- **Design tokens** (`web/src/styles/tokens.css`): CSS custom properties; light & dark via `[data-theme]`. Semantic palette: `--trend-up` (warming/drying), `--trend-down` (cooling/greening), `--accent` (teal), `--surface`, `--text`. 8px spacing; radii 4/8/16; focus rings 3px `--accent`.
- **Charts:** dependency-free **SVG** (`Charts.tsx`) — multi-series line, uncertainty ribbon for forecast (`lower`→`upper` path), Mann–Kendall significance marker, x ticks sparse. No Plotly/D3 bundle.
- **Graphics/badges:** SVG arrows for trend direction; coverage chips; “case-file” cards for Opposite Trend (red border = drying cell, green = greening cell).
- **Typography:** system stack + optional Inter via CDN; numeric tabular figures (`font-variant-numeric: tabular-nums`).

## Interaction specs
| Interaction | Behavior |
|---|---|
| Click map | Recenter pin, fetch `/place?lat&lon`, show panel loading skeleton, then tabs |
| Time slider | Scrub GIBS overlays and chart cursor (future step animated dashed) |
| Layer toggles | Add/remove GIBS raster sources client-side |
| Explainer | Always shows generator badge (“templated” vs “AI”) and confidence |
| Low-bandwidth mode | Hides imagery tiles, charts render text-first; stored in localStorage |
| Watchlist | Star places → local CSV export of trends/anomaly notes |
| Theme | `prefers-color-scheme` default + header toggle |

## Accessibility & i18n
- Keyboard: panel is a `dialog` with focus trap & `Esc` close; all controls real buttons/labels.
- Contrast ≥ 4.5:1 (text) / 3:1 (UI) in both themes; `:focus-visible` outline always visible.
- `role=\"img\"` + descriptive `aria-label` on map & charts; charts also have a `<table>`-toggle with raw numbers.
- i18n-ready: `src/lib/i18n.ts`-style string table (`en` shipped; `hi`, `kn` mirrored keys). `<html lang>` set dynamically; numbers/dates via `Intl.*`.

## Empty / loading / error states
- **Loading:** skeleton chart + pulsing pin.
- **Error:** panel shows message + “retry” + degraded view (trends/coverage only) — never a blank screen.
- **Missing param:** chart slot shows “No coverage for this location/period” (e.g., sea level away from coast) — not zero.

## Low-bandwidth / offline demo
The whole demo runs offline once `data/samples/earth_pulse_sample.npz` exists: API serves it, frontend is static. Set `?lowbandwidth` or the header toggle to strip imagery.

## What to show (and what not to claim)
`Observed` (satellite/reanalysis) → `Model forecast p10–p90` → `AI-generated scenario` are labeled distinctly; the map never implies certainty.
