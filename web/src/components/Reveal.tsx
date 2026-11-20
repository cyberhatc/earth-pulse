"use client";

import { useEffect, useState } from "react";

interface RevealProps {
  children: React.ReactNode;
  /** Delay in milliseconds before the reveal starts (for staggered entries). */
  delay?: number;
  /** Once revealed, keep visible even if the element leaves the viewport. */
  once?: boolean;
}

/**
 * Mount-aware reveal animation. Fades content in with a small upward drift.
 * Respects prefers-reduced-motion via globals.css (content is visible immediately).
 * Safe to use on route-mounted elements; plays once on mount.
 */
export function Reveal({ children, delay = 0, once = true }: RevealProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(id);
  }, [delay]);

  return (
    <span
      aria-hidden="true"
      style={{ display: "contents" }}
      className={`reveal ${visible && once ? "reveal-in" : ""}`}
    >
      {children}
    </span>
  );
}
