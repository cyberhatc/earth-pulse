# UI/UX — Earth Pulse frontend

**Map-first. One question: “What is happening to this place?”**

## Information architecture (current flow)
- **Landing (`/`)**: marketing/about page with clear entry into the app.
- **Map-first entry (`/regions`)**: interactive map as the primary starting experience showing **exactly 3 predefined case-study locations** (Western Ghats + Arabian Sea, North China Plain, California Coast) derived from `web/src/lib/data.ts`. Markers support hover/tap info (name, region/area, key variable/trend highlight, source/status) and click-to-inspect.
- **Location details (`/region/:slug`)**: deep-linkable selected-location overview with persisted context (metadata, coordinates/slug, analysis status, coverage) and integrated navigation to all sub-features.
- **Integrated sub-features (deep-linkable, context-preserving):**
  - `/region/:slug/visualizations` — data visualizations (observed series, trends/stats, forecast with uncertainty bands, anomalies, opposite trends, climate twin/comparison context, imagery/evidence, coverage/provenance)
  - `/region/:slug/chat` — location-aware chatbot grounded in fetched/computed location payload (facts-locked backend chat where available)
  - `/region/:slug/videos` — observed past timelapse/reference imagery and projected future visualization frames; scenario generation status/conditioning wiring with clear labeling
  - `/region/:slug/map` — in-region map inspection, point pinning, spatial context
  - `/region/:slug/notebook` — investigation notebook/report, evidence, export/share actions

## Layout & components
- **Entry map (`LocationsMap`, `web/src/components/LocationsMap.tsx`)**: Leaflet map with 3 region markers/bounds, tooltips/popups, and reliable click navigation into `/region/:slug`.
- **Location details (`RegionHubPage`)**: comprehensive data view combining historical observed/demo series, trend/statistics (slope per decade, significance/CI), forecast/projections with uncertainty bands, anomalies/events, opposite-trend insights, climate twin/comparison info (when available), imagery/evidence snapshots, and coverage/provenance/limitations.
- **Visualizations (`RegionVisualizationsPage`)**: labeled charts/cards for observed trends, forecast uncertainty, anomalies, opposite trends, coverage/evidence and supporting imagery; unavailable parameters handled explicitly.
- **Videos (`RegionVideosPage`)**: `/imagery/timelapse.gif` and `/imagery/timelapse` (observed/derived timeline as provided), `/imagery/projected` SVG frames (model-projected, not observations), `/imagery/past` references, and `/imagery/scenario` status/conditioning (AI-generated scenario wiring/stub when generation unavailable).
- **Chat (`ChatPanel`)**: location-aware conversation grounded in selected location payload/analysis and backend `/chat`; source/coverage context surfaced in UI/copy where appropriate.
- **Existing preserved features**: map inspection, notebook/report, artifact cards/canvas, evidence/coverage cards, exports/share links, context chip/navigation, live/demo fallback behavior.

## Honesty & labeling
- Clearly distinguish **observed/reference**, **forecast/projected (model-derived, with uncertainty)**, and **AI-generated/synthetic/demo** content.
- Show unavailable parameters, coverage gaps, time range, and provenance/limitations from backend payloads when present.
- Never present projected frames, scenario media, or demo fallbacks as observations.

## Accessibility & UX
- Route-based, deep-linkable flow with persistent selected location context across subviews.
- Responsive layouts for map, detail sections, cards, imagery grids, and navigation.
- Clear CTAs, loading/error states, and graceful handling of missing backend data/endpoints.
- Existing theme/accessibility patterns retained (focusable controls, readable contrast, semantic structure where possible).
