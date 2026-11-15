# Earth Pulse Landing Redesign Requirements

**Status:** Planning & implementation guidance (frontend landing route `/`)  
**Audience:** Frontend engineering, design, release  
**Scope:** Landing page experience only. No backend, RAG, API contract, database, scientific-engine, or data-pipeline changes.

## 1. Intent

Transform the Earth Pulse landing page into a premium, cinematic scientific-intelligence entry experience that feels like entering an advanced Earth-observation archive/investigation platform—distinctive, credible, and restrained—while preserving the existing monochrome editorial identity and all working functionality.

## 2. Identity (must preserve)

- **Aesthetic:** monochrome black-and-white/grayscale, editorial scientific archive (specimen frames, double rules, precise spacing, evidence-first tone).
- **Typography system:** Cormorant Garamond (display/editorial), IBM Plex Mono (labels/meta/specimen), Plus Jakarta Sans (UI/body where used). Maintain hierarchy, line length, and rhythm.
- **Tone:** scientifically credible, honest about provenance/uncertainty, no marketing hype, no fabricated claims.
- **Do not become:** generic SaaS, neon AI dashboard, colorful space-game, or decorative 3D portfolio.

## 3. Hero concept (cinematic Earth centerpiece)

- **Primary visual:** a living Earth as the centerpiece. Preferred implementation: a realistic, slow-rotating grayscale 3D Earth (Three.js / React Three Fiber if appropriate and dependencies approved) with subtle atmosphere, cloud detail, and restrained latitude/longitude lines, rendered with sophisticated monochrome lighting and depth.
- **Current delivered baseline:** a cinematic, responsive full-bleed Earth video hero (`web/public/videos/earth-pulse-earth-desktop.mp4` 16:9 for desktop, `earth-pulse-earth-mobile.mp4` 9:16 for mobile) with gradient overlay, preserved legibility, and graceful fallback. This baseline preserves performance and avoids 3D dependency/lockfile conflicts in the current release state.
- **Behavior:** slow, elegant motion; never obstruct headline, primary CTA, or navigation. Scroll-led narrative reveals (GSAP/ScrollTrigger where present) with Lenis smooth scrolling only when synchronized and non-disruptive.
- **Micro-interactions:** subtle, independent UI details (e.g. scroll indicator) must not compete with scroll/hero motion ownership.
- **Honesty:** decorative/cinematic visualization must not imply live satellite feeds or fabricated observations.

## 4. Section narrative (required landing structure)

1. **Arrival** — immediate clarity of purpose ("Earth observation and scientific trend investigation"), cinematic hero, strong headline/lede, primary CTA to Case Files/Regions, minimal navigation.
2. **Planet in Motion** — visual storytelling that Earth systems change; scroll-led progression, restrained copy.
3. **Investigation** — the three existing case studies (Western Ghats, North China Plain, California Coast) presented as scientific investigation files; routes and functionality must continue to work.
4. **Scientific Instruments** — existing analytical capabilities/modules presented editorially and truthfully (no invented capabilities).
5. **Evidence** — trend investigation, spatial exploration, evidence, uncertainty, reproducibility, and data provenance; preserve honest distinctions (live/demo/synthetic as applicable).
6. **Discovery** — decisive closing composition and clear path into the Regions/case-files workflow.

## 5. Content, navigation, and integrity requirements

- Preserve all existing routes, CTAs, case-study links, TopBar behavior, live preview ledger data flow, and provenance/sourcing meaning.
- Do not fabricate data, metrics, sources, or capabilities.
- Region/case-study navigation must remain functional and obvious.
- Any 3D markers or highlights (Western Ghats, North China Plain, California Coast) must map to existing region routes only as navigational affordances, not as claims of live observation.

## 6. Responsive, accessibility, and motion

- **Responsive:** desktop/laptop/tablet/mobile with intentional composition (not just scaled-down desktop). Mobile uses the 9:16 asset/simplified experience, readable typography, accessible CTAs, no horizontal overflow.
- **Accessibility:** semantic structure, keyboard access, visible focus, sufficient contrast, labeled interactive elements, logical heading/navigation order, skip navigation, and screen-reader-usable core flows.
- **Reduced motion:** respect `prefers-reduced-motion: reduce`—disable/simplify smooth scrolling, parallax/scrub theatrics, continuous motion, and autoplaying hero motion; provide a static, legible fallback.
- **Fallbacks:** static hero fallback on reduced-motion, media error, or unsupported rendering path; content and CTAs must remain fully usable.

## 7. Performance and quality

- Lazy-load heavy visual/media/3D assets; do not block first meaningful content or primary CTA.
- `object-fit: cover`, capped resource cost, pause/offscreen considerations for continuous effects.
- No layout shifts from hero/media; no console errors.
- Verification required: routes/CTAs, desktop/mobile, reduced-motion, fallback behavior, console/network, and build/type checks.

## 8. Release & scope constraints

- Frontend-only. No backend/RAG/API/database/scientific-engine/data-pipeline changes. No unrelated dependency upgrades. No commits/pushes without explicit authorization and a clean, conflict-free selective diff (respect pre-existing staged work and lockfile integrity).
