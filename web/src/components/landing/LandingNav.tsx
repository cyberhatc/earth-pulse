import { useEffect, useId, useState } from "react";
import { Link } from "react-router-dom";

const NAV_ITEMS = [
  { href: "#about", label: "About" },
  { href: "#observe", label: "Observation" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#regions", label: "Regions" },
  { href: "#signals", label: "Signals" },
  { href: "#variables", label: "Variables" },
  { href: "#methods", label: "Methods" },
  { href: "#sources", label: "Data sources" },
  { href: "#imagery", label: "Imagery" },
  { href: "#transparency", label: "Transparency" },
];

const MOBILE_NAV_BREAKPOINT = 1200;

export function LandingNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [active, setActive] = useState<string>("#hero");
  const navId = useId();

  useEffect(() => {
    const ids = [
      "hero",
      "about",
      "observe",
      "how-it-works",
      "regions",
      "signals",
      "variables",
      "methods",
      "sources",
      "imagery",
      "transparency",
      "launch",
    ];
    const sections = ids
      .map((id) => document.getElementById(id))
      .filter(Boolean) as HTMLElement[];
    if (!sections.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target?.id) setActive(`#${visible.target.id}`);
      },
      { rootMargin: "-20% 0px -55% 0px", threshold: [0.1, 0.25, 0.5] }
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > MOBILE_NAV_BREAKPOINT) setMenuOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    if (window.innerWidth <= MOBILE_NAV_BREAKPOINT) {
      document.body.style.overflow = "hidden";
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  return (
    <header className="topbar landing-nav-wrap">
      <div className="topbar-inner landing-nav-inner">
        <div className="topbar-left landing-brand">
          <Link to="/" className="wordmark landing-wordmark" aria-label="Earth System Trend Detective home">
            <span className="landing-wordmark-full">Earth System Trend Detective</span>
            <span className="landing-wordmark-short" aria-hidden="true">Earth Pulse</span>
          </Link>
        </div>
        <button
          type="button"
          className="landing-menu-toggle"
          aria-expanded={menuOpen}
          aria-controls={navId}
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span className="landing-menu-bars" aria-hidden="true" />
          <span className="landing-menu-text">{menuOpen ? "Close" : "Menu"}</span>
        </button>
        <nav
          id={navId}
          className={`topbar-nav landing-section-nav ${menuOpen ? "open" : ""}`}
          aria-label="Landing page sections"
        >
          {NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`topbar-link landing-anchor ${active === item.href ? "active" : ""}`}
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </a>
          ))}
          <Link
            to="/regions"
            className="landing-cta-link"
            onClick={() => setMenuOpen(false)}
          >
            Explore Earth Pulse
          </Link>
        </nav>
      </div>
    </header>
  );
}