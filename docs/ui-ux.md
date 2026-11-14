# UI/UX — Earth Pulse frontend

**Map-first. One question: “What is happening to this place?”**

## Information architecture (actual)
Header (logo · language · theme) ┊ Toolbar (Hi-Res · Belgaum · Low-BW · GitHub · Search)
┊ MapLibre GL (full screen, OSM/positron)
┊ Time slider
┊ Layer toggles (GIBS NDVI · SST · Snow)
┊ Full-screen panel (click map → opens) with sticky tabs: Overview · Imagery · Opposite Trends · Why
┊ Footer (NASA credits · MIT license · Space Apps 2026)

## Layout & components
- **Full-bleed map** (MapLibre GL JS). Opening panel takes the **entire viewport** (position fixed z-index 30). Close via ✕ button or backdrop click. No slide-over 440px panel remains.
- **Design tokens** (`web/src/styles/tokens.css`): CSS custom properties; light & dark via `[data-theme]`. Semantic palette: `--trend-up` (warming/drying), `--trend-down` (cooling/greening), `--accent` (teal), `--surface`, `--text`. 8px spacing; radii 4/8/16; focus rings 3px `--accent`.
- **Charts:** dependency-free **SVG** (`Charts.tsx`) — multi-series line, uncertainty ribbon for forecast (`lower`→`upper` path), Mann–Kendall significance marker.
- **Imagery gallery:** professional grid with year/layer badges, hover lift/scale, staggered entrance animation.
- **Time-lapse slider:** 2000→2030 with play/pause (component `TimeLapse`).
- **Time-lapse video:** animated GIF served `/imagery/timelapse.gif?lat&lon&start_year&end_year`. 512×512, ~1 km/pixel, 5×5 tile mosaic covering ~1280 km (e.g., south India). Red crosshair marks the clicked point.
- **Typography:** system stack + tabular numerals.

## Interaction specs
| Interaction | Behavior |
|---|---|
| Click map | Recenter pin, fetch `/place` or `/point`, full-screen panel opens |
| Time slider | Scrub GIBS overlays |
| Layer toggles | Add/remove GIBS raster sources |
| Explainer | Always shows generator badge ("templated" vs "AI") |
| Low-bandwidth mode | Hides imagery tiles, charts render text-first |
| Watchlist | Star places → local CSV export |
| Theme | `prefers-color-scheme` default + header toggle |

## Accessibility & i18n
- Keyboard: panel has focus ring; `:focus-visible` always visible. **Esc-close is not implemented yet**.
- Contrast ≥ 4.5:1 in both themes (not programmatically verified).
- `role="img"` + `aria-label` on map & charts.
- i18n: `en` shipped; `hi`, `kn` mirrored keys in `src/lib/i18n.ts`.

## Empty / loading / error states
- **Loading:** skeleton chart + pulsing pin.
- **Error:** panel shows message + retry.
- **Missing param:** chart slot shows "No coverage" — not zero.
