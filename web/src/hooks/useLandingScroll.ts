import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger);

type Options = {
  root: HTMLElement | null;
  reducedMotion: boolean;
  enabled: boolean;
};

/**
 * Lenis (smooth scroll) + GSAP/ScrollTrigger — landing scope.
 * GSAP/ScrollTrigger owns scroll-linked DOM transitions/reveals.
 * No 3D/scene choreography.
 */
export function useLandingScroll({ root, reducedMotion, enabled }: Options) {
  useEffect(() => {
    if (!enabled || !root) return;

    const ctx = gsap.context(() => {
      let lenis: Lenis | null = null;
      let tickerCb: ((time: number) => void) | null = null;

      if (!reducedMotion) {
        lenis = new Lenis({
          duration: 1.05,
          smoothWheel: true,
          syncTouch: false,
        });

        ScrollTrigger.scrollerProxy(document.documentElement, {
          scrollTop(value?: number) {
            if (typeof value === "number") {
              lenis!.scrollTo(value, { immediate: true });
            }
            return lenis!.scroll;
          },
          getBoundingClientRect() {
            return { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
          },
          pinType: document.documentElement.style.transform ? "transform" : "fixed",
        });

        const onLenisScroll = () => ScrollTrigger.update();
        lenis.on("scroll", onLenisScroll);

        tickerCb = (time: number) => {
          lenis!.raf(time * 1000);
        };
        gsap.ticker.add(tickerCb);
        gsap.ticker.lagSmoothing(0);

        ScrollTrigger.addEventListener("refresh", () => lenis?.resize());
        (root as any).__lenis = lenis;
      } else {
        (root as any).__lenis = null;
      }

      // DOM reveals (GSAP-owned)
      const reveals = Array.from(root.querySelectorAll<HTMLElement>("[data-l-reveal]"));
      if (!reducedMotion) {
        reveals.forEach((el) => {
          gsap.fromTo(
            el,
            { autoAlpha: 0, y: 28 },
            {
              autoAlpha: 1,
              y: 0,
              duration: 0.85,
              ease: "power2.out",
              scrollTrigger: {
                trigger: el,
                start: "top 86%",
                toggleActions: "play none none reverse",
              },
            },
          );
        });

        const staggers = Array.from(root.querySelectorAll<HTMLElement>("[data-l-stagger]"));
        staggers.forEach((container) => {
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
              scrollTrigger: {
                trigger: container,
                start: "top 84%",
                toggleActions: "play none none reverse",
              },
            },
          );
        });
      } else {
        reveals.forEach((el) => {
          el.style.opacity = "1";
          el.style.transform = "none";
        });
      }

      requestAnimationFrame(() => ScrollTrigger.refresh());

      return () => {
        if (tickerCb) gsap.ticker.remove(tickerCb);
        if (lenis) {
          try {
            lenis.destroy();
          } catch {}
        }
        try {
          delete (root as any).__lenis;
        } catch {}
      };
    }, root);

    return () => {
      ctx.revert();
      ScrollTrigger.getAll().forEach((t) => {
        const trig = t.trigger as Element | null;
        if (trig && root.contains(trig)) t.kill();
      });
    };
  }, [root, reducedMotion, enabled]);
}
