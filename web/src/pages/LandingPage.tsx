import { useEffect, useRef, useState } from "react";
import { TopBar } from "../components/TopBar";
import { ArrivalSection } from "../components/landing/sections/ArrivalSection";
import { PlanetMotionSection } from "../components/landing/sections/PlanetMotionSection";
import { InvestigationSection } from "../components/landing/sections/InvestigationSection";
import { InstrumentsSection } from "../components/landing/sections/InstrumentsSection";
import { EvidenceSection } from "../components/landing/sections/EvidenceSection";
import { DiscoverySection } from "../components/landing/sections/DiscoverySection";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { useLandingScroll } from "../hooks/useLandingScroll";
import { useAnimeMicro } from "../hooks/useAnimeMicro";
import "../styles/landing.css";

const DESKTOP_VIDEO = "/videos/earth-pulse-earth-desktop.mp4";
const MOBILE_VIDEO = "/videos/earth-pulse-earth-mobile.mp4";
// Mobile breakpoint: portrait/small viewports use the dedicated mobile (9:16) video.
const MOBILE_QUERY = "(max-width: 768px)";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(MOBILE_QUERY).matches;
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(MOBILE_QUERY);
    const onChange = () => setIsMobile(mql.matches);
    onChange();
    if (mql.addEventListener) mql.addEventListener("change", onChange);
    else mql.addListener(onChange);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", onChange);
      else mql.removeListener(onChange);
    };
  }, []);
  return isMobile;
}

export function LandingPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const isMobile = useIsMobile();
  const [videoFailed, setVideoFailed] = useState(false);

  useLandingScroll({
    root: rootRef.current,
    reducedMotion,
    enabled: true,
  });

  useAnimeMicro({ enabled: !reducedMotion, root: rootRef.current });

  // Reset failure state when the selected source changes (e.g. breakpoint change)
  const videoSrc = isMobile ? MOBILE_VIDEO : DESKTOP_VIDEO;
  useEffect(() => {
    setVideoFailed(false);
  }, [videoSrc]);

  // Anchor scrolling via Lenis when available (keeps ScrollTrigger in sync)
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const a = target?.closest?.('a[href^="#"]') as HTMLAnchorElement | null;
      if (!a) return;
      const hash = a.getAttribute("href");
      if (!hash || hash === "#") return;
      const el = document.querySelector(hash);
      if (!el) return;
      e.preventDefault();
      const lenis = (root as any).__lenis;
      if (lenis && !reducedMotion) {
        lenis.scrollTo(el as HTMLElement, { offset: -20 });
      } else {
        (el as HTMLElement).scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
      }
      history.pushState(null, "", hash);
    };
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, [reducedMotion]);

  // Respect reduced motion: do not autoplay a moving background video.
  const showVideo = !reducedMotion && !videoFailed;

  return (
    <div className="page landing-root" ref={rootRef}>
      <div className="landing-video-layer" aria-hidden="true">
        {showVideo ? (
          <video
            key={videoSrc}
            className={`landing-video ${isMobile ? "landing-video--mobile" : "landing-video--desktop"}`}
            src={videoSrc}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            onError={() => setVideoFailed(true)}
          />
        ) : (
          <div className="landing-video-fallback" />
        )}
        <div className="landing-video-overlay" />
      </div>

      <div className="landing-content">
        <TopBar />
        <main id="main-content">
          <ArrivalSection />
          <PlanetMotionSection />
          <InvestigationSection />
          <InstrumentsSection />
          <EvidenceSection />
          <DiscoverySection />
        </main>
      </div>
    </div>
  );
}
