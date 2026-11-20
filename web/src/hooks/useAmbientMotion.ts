"use client";

import { useEffect, useRef, type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

let registered = false;
function ensurePlugins() {
  if (registered) return;
  gsap.registerPlugin(ScrollTrigger);
  registered = true;
}

type Options = {
  /** Ref to the page/section container that should be observed. */
  scopeRef: RefObject<HTMLElement | null>;
  reducedMotion: boolean;
  enabled: boolean;
};

/**
 * Ambient scroll motion for internal pages — mirrors the landing page's
 * GSAP/ScrollTrigger motion language (fade+rise reveals, staggered groups,
 * subtle parallax) so every screen of the app feels cohesive.
 */
export function useAmbientMotion({ scopeRef, reducedMotion, enabled }: Options) {
  useEffect(() => {
    const host = scopeRef.current;
    if (!enabled || reducedMotion || !host) return;

    ensurePlugins();

    const ctx = gsap.context(() => {
      // Scroll-triggered fade + rise reveals.
      gsap.utils.toArray<HTMLElement>("[data-l-reveal]", host).forEach((el) => {
        gsap.fromTo(
          el,
          { autoAlpha: 0, y: 28 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.85,
            ease: "power2.out",
            scrollTrigger: { trigger: el, start: "top 88%" },
          },
        );
      });

      // Staggered group reveals.
      gsap.utils.toArray<HTMLElement>("[data-l-stagger]", host).forEach((container) => {
        const items = Array.from(container.children) as HTMLElement[];
        if (!items.length) return;
        gsap.fromTo(
          items,
          { autoAlpha: 0, y: 22 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.75,
            ease: "power2.out",
            stagger: 0.08,
            scrollTrigger: { trigger: container, start: "top 84%" },
          },
        );
      });

      // Subtle parallax drift for opted-in elements.
      gsap.utils.toArray<HTMLElement>("[data-l-parallax]", host).forEach((el) => {
        gsap.fromTo(
          el,
          { y: 40 },
          {
            y: 0,
            duration: 1.1,
            ease: "power2.out",
            scrollTrigger: {
              trigger: el,
              start: "top bottom",
              end: "bottom top",
              scrub: 0.6,
            },
          },
        );
      });
    }, host);

    return () => {
      ctx.revert();
      ScrollTrigger.getAll().forEach((t) => {
        const trig = t.trigger as Element | null;
        if (trig && host.contains(trig)) t.kill();
      });
    };
  }, [scopeRef, reducedMotion, enabled]);
}
