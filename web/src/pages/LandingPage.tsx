import { useEffect, useRef, useState } from "react";
import type Lenis from "lenis";
import { LandingNav } from "../components/landing/LandingNav";
import { ArrivalSection } from "../components/landing/sections/ArrivalSection";
import { ObservationSection } from "../components/landing/sections/ObservationSection";
import { AboutSection } from "../components/landing/sections/AboutSection";
import { HowItWorksSection } from "../components/landing/sections/HowItWorksSection";
import { RegionsSection } from "../components/landing/sections/RegionsSection";
import { SignalsSection } from "../components/landing/sections/SignalsSection";
import { VariablesSection } from "../components/landing/sections/VariablesSection";
import { MethodsSection } from "../components/landing/sections/MethodsSection";
import { DataSourcesSection } from "../components/landing/sections/DataSourcesSection";
import { ImagerySection } from "../components/landing/sections/ImagerySection";
import { TransparencySection } from "../components/landing/sections/TransparencySection";
import { LaunchSection } from "../components/landing/sections/LaunchSection";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { useLandingScroll } from "../hooks/useLandingScroll";
import { useAnimeMicro } from "../hooks/useAnimeMicro";
import "../styles/landing.css";

const DESKTOP_VIDEO = "/videos/earth-pulse-earth-desktop.mp4";
const MOBILE_VIDEO = "/videos/earth-pulse-earth-mobile.mp4";
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
  const lenisRef = useRef<Lenis | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const isMobile = useIsMobile();
  const [videoFailed, setVideoFailed] = useState(false);

  useLandingScroll({
    root: rootRef,
    reducedMotion,
    enabled: true,
    lenisRef,
  });

  useAnimeMicro({ enabled: !reducedMotion, root: rootRef });

  const videoSrc = isMobile ? MOBILE_VIDEO : DESKTOP_VIDEO;
  useEffect(() => {
    setVideoFailed(false);
  }, [videoSrc]);

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
      const lenis = lenisRef.current;
      if (lenis && !reducedMotion) {
        lenis.scrollTo(el as HTMLElement, { offset: -80 });
      } else {
        (el as HTMLElement).scrollIntoView({
          behavior: reducedMotion ? "auto" : "smooth",
          block: "start",
        });
      }
      history.pushState(null, "", hash);
    };
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, [reducedMotion, lenisRef]);

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
        <LandingNav />
        <main>
          <ArrivalSection />
          <ObservationSection />
          <AboutSection />
          <HowItWorksSection />
          <RegionsSection />
          <SignalsSection />
          <VariablesSection />
          <MethodsSection />
          <DataSourcesSection />
          <ImagerySection />
          <TransparencySection />
          <LaunchSection />
        </main>
      </div>
    </div>
  );
}
