# Earth Pulse — Frontend Design Requirements

**Version:** 1.1 (approved direction, 2026-11-15)  
**Audience:** Frontend engineering, design, QA, release  
**Scope:** Frontend UI/UX only. No backend, RAG, API contract, database, scientific-engine, or data-pipeline changes.

## 1. Purpose and product intent

Earth Pulse is an Earth observation and scientific trend investigation platform. The interface must communicate scientific credibility, evidence-first storytelling, and investigative clarity. Every visual or interactive element must either aid understanding, navigation, or trust.

## 2. Premium monochrome scientific identity

- **Palette:** black, white, and restrained grayscale/tonal variations only (existing tokens: `--bg`, `--surface`, `--ink`, `--ink-soft`, `--ink-faint`, `--line`, `--line-strong`, `--accent`, `--trend-*`). No random neon colors, no purple/blue “AI dashboard” gradients, no decorative clutter.
- **Typography:** editorial system — Cormorant Garamond (display/editorial), IBM Plex Mono (labels, specimen/meta), Plus Jakarta Sans (UI/body). Clear hierarchy, comfortable line length, consistent scale.
- **Motifs:** specimen frames, double rules, archival labels, precise spacing, disciplined alignment. The interface should feel like a living scientific archive/observatory.
- **Consistency:** one wordmark/product name across nav, document titles, metadata, and key headings; consistent module naming and ordering across routes.

## 3. Cinematic Earth hero and regional Earth context

- **Landing page (centerpiece):** a realistic, slow, elegant grayscale Earth as cinematic hero. Preferred: 3D Earth (Three.js / React Three Fiber where appropriate and approved) with subtle atmosphere, cloud detail, and restrained latitude/longitude lines, sophisticated monochrome lighting/depth. **Current baseline:** cinematic responsive Earth video hero (16:9 desktop, 9:16 mobile) with overlay and static fallback, preserving identity and performance without unapproved 3D dependency/lockfile risk.
- **Regions dashboard:** a lighter, subtle Earth/context visualization (low-cost; restrained 2D/3D locator or static treatment) that orients users spatially without competing with case-file content.
- **Region locators:** highlight **Western Ghats, North China Plain, and California Coast** with subtle, legible monochrome markers/labels tied to existing region routes. Markers are navigational aids only.
- **Integrity:** Earth hero/visualization is **decorative/contextual**. It must **not** imply live satellite observations, real-time telemetry, or fabricated measurements. Scientific values come only from existing verified data flows.
- **Resilience:** where 3D/media is used, lazy-load and provide a static, high-quality fallback for no-WebGL, load failure, or reduced-motion contexts.

## 4. Landing-page hero and narrative

- Cinematic arrival: near-black field, strong editorial headline, concise product statement, obvious primary CTA into existing Regions/case-files workflow, minimal navigation, deliberate whitespace.
- Earth visual impact without obstructing readability or CTAs.
- Scroll-led storytelling (Arrival, Planet in Motion, Investigation, Scientific Instruments, Evidence, Discovery/CTA) with intentional transitions; no scroll hijacking.
- Preserve existing routes, destinations, and meaning of case studies and capabilities.

## 5. Regions dashboard and case-file presentation

- Subtle locator/context presence reinforcing geographic context.
- Premium case-file cards: clear hierarchy (region name, period, bbox/context, key variable/teaser, status/provenance cues), consistent specimen styling, strong hover/focus states, direct navigation to existing routes.
- Consistent navigation and page hierarchy; stable headings and clear relationships between overview, hub, chat, map, and notebook.
- Western Ghats, North China Plain, and California Coast clearly identifiable and linked.

## 6. Map legends and selection states

- Legends reflect **actual available data, layers, variables, and units** from the existing frontend/data contract; never imply unavailable layers or fabricated precision.
- Clearly distinguish **illustrative/sampled visualization** from **fetched/selected point value**.
- Provide semantic/quantitative legend (color meaning, units/scale where applicable, neutral/insufficient-data state) consistent with the variable shown.
- Visible selection, clear active/hover/focus styling, readable coordinate/value context; keyboard-accessible alternatives where direct marker focus is not feasible.
- Disabled/unavailable controls (e.g. raw-values layer) must be honestly labeled and non-misleading.

## 7. Chat and artifact workspace improvements

- **Discoverability:** make Opposite Trend Detector and other key investigative actions explicitly discoverable via clear UI affordances, not only buried in suggested prompts.
- Clear conversation context, loading/fallback states, and distinction between user prompt, system/template response, and evidence/artifact cards.
- Consistent card framing, labels, provenance/limitation cues, readable layout across chat, map, and notebook.
- **Copy hygiene:** remove raw internal identifiers from user-facing copy; use human-readable labels.

## 8. Scientific notebook presentation

- Structured, readable, reproducible presentation (question/context, method/evidence, results, limitations, provenance).
- Preserve honest uncertainty and data-source distinctions (demo/synthetic/live as surfaced by existing flows).
- Monochrome editorial styling, printable/readable hierarchy, accessible tables/charts/figures.

## 9. Accessibility and responsive requirements

- **Semantics & structure:** landmarks, logical headings, labeled controls, descriptive link/button text, accessible names.
- **Keyboard:** full keyboard navigation, visible `:focus-visible` indicators, logical tab order, no keyboard traps, skip-to-content link.
- **Screen readers:** status announcements where appropriate (live regions for dynamic updates), meaningful alt/ARIA where needed, no reliance on color alone.
- **Contrast & readability:** sufficient contrast in light/dark themes, legible type/line height, adequate touch targets.
- **Responsive:** usable desktop/laptop/tablet/mobile layouts; no horizontal overflow; charts/maps/controls adapt without loss of core function.

## 10. States: loading, hover, focus, active, disabled

- **Loading:** skeleton/progress/placeholder states that preserve layout and communicate activity.
- **Hover:** subtle, consistent affordance within monochrome system, never the sole indicator.
- **Focus:** always-visible, high-clarity focus ring/outline.
- **Active/selected:** unambiguous selected state with sufficient contrast.
- **Disabled/unavailable:** visually distinct, non-interactive, and explained.
- **Error/empty:** honest, actionable messaging without exposing raw internal errors/IDs.

## 11. Performance and reduced-motion requirements

- **Performance:** lazy-load heavy/3D/media assets, avoid blocking first meaningful paint, minimize layout shifts, cap rendering cost on low-power/mobile, pause/stop non-essential animation when offscreen.
- **Reduced motion:** honor `prefers-reduced-motion: reduce` by disabling/simplifying smooth scrolling, parallax, scrub theatrics, continuous rotation, and non-essential transitions; provide static equivalents.
- **Fallbacks:** static hero/visualization fallback for no-WebGL, load failure, or reduced-motion contexts; core content and navigation remain functional.

## 12. Decorative vs. scientific data (non-negotiable)

| Category | Examples | Rules |
|---|---|---|
| **Decorative / contextual** | Earth hero/video/3D globe, atmosphere, graticule, cinematic backgrounds, motion effects, locator markers (orientation) | May aid orientation/mood; must not claim to represent live or measured phenomena; must degrade gracefully. |
| **Scientific / evidentiary** | Trend values, charts, fetched point data, anomalies, twins, notebook outputs, provenance, limitations | Must come from existing verified data flows/contracts; units, periods, and uncertainty/limitations must be shown or clearly available; never fabricated. |

## 13. Verification checklist (frontend release)

- Build, lint (`tsc --noEmit` where applicable), and type checks pass for changed frontend scope.
- Desktop and mobile layouts verified; no unintended overflow.
- All existing routes and region workflows function.
- Hero/visualization fallback and reduced-motion behavior verified.
- Keyboard navigation, focus visibility, and basic accessibility checks performed.
- No console errors introduced; no secrets/credentials committed; unrelated work preserved.

## 14. Out of scope

Backend, RAG, API routes/contracts, database, scientific/statistical engine, data pipelines, authentication/server behavior, and teammate-owned unrelated files. No fabricated observations or capabilities.