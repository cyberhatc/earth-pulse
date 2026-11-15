import { useEffect } from "react";
import anime from "animejs";

type Options = {
  enabled: boolean;
  root: HTMLElement | null;
};

/**
 * Anime.js v3 — isolated UI micro-interactions only.
 * Targets elements/properties NOT controlled by GSAP/ScrollTrigger/Lenis/R3F.
 */
export function useAnimeMicro({ enabled, root }: Options) {
  useEffect(() => {
    if (!enabled || !root) return;

    const instances: anime.AnimeInstance[] = [];
    const listeners: Array<{ el: Element; type: string; fn: EventListener }> = [];

    // Scroll indicator dot — gentle loop (independent of scroll progress)
    const dot = root.querySelector<HTMLElement>("[data-anime='scroll-dot']");
    if (dot) {
      instances.push(
        anime({
          targets: dot,
          translateY: [0, 22, 0],
          opacity: [0.2, 1, 0.2],
          easing: "easeInOutSine",
          duration: 1800,
          loop: true,
        }),
      );
    }

    // Fine hover accents on designated elements (transform/opacity only, not GSAP-owned)
    const accents = Array.from(root.querySelectorAll<HTMLElement>("[data-anime='accent']"));
    accents.forEach((el) => {
      const onEnter: EventListener = () => {
        instances.push(
          anime({
            targets: el,
            scale: [1, 1.015],
            duration: 420,
            easing: "easeOutQuad",
          }),
        );
      };
      const onLeave: EventListener = () => {
        instances.push(
          anime({
            targets: el,
            scale: [1.015, 1],
            duration: 420,
            easing: "easeOutQuad",
          }),
        );
      };
      el.addEventListener("mouseenter", onEnter);
      el.addEventListener("mouseleave", onLeave);
      el.addEventListener("focus", onEnter);
      el.addEventListener("blur", onLeave);
      listeners.push(
        { el, type: "mouseenter", fn: onEnter },
        { el, type: "mouseleave", fn: onLeave },
        { el, type: "focus", fn: onEnter },
        { el, type: "blur", fn: onLeave },
      );
    });

    // Subtle specimen mark pulse on view (one-shot, fine detail)
    const marks = Array.from(root.querySelectorAll<HTMLElement>("[data-anime='mark']"));
    let io: IntersectionObserver | null = null;
    if (marks.length && "IntersectionObserver" in window) {
      io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              instances.push(
                anime({
                  targets: entry.target,
                  opacity: [0.55, 1],
                  easing: "easeOutQuad",
                  duration: 800,
                }),
              );
              io?.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.4 },
      );
      marks.forEach((m) => io!.observe(m));
    }

    return () => {
      io?.disconnect();
      listeners.forEach(({ el, type, fn }) => el.removeEventListener(type, fn));
      instances.forEach((inst) => {
        try {
          inst.pause();
          anime.remove(inst.animatables?.map((a: any) => a.target) ?? []);
        } catch {
          // noop
        }
      });
      // ensure targets reset cleanly
      if (dot) anime.remove(dot);
      marks.forEach((m) => anime.remove(m));
      accents.forEach((a) => anime.remove(a));
    };
  }, [enabled, root]);
}
