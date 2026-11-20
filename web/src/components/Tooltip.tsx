"use client";

import { useRef, useState, useCallback } from "react";

type TooltipPlacement = "top" | "bottom" | "left" | "right";

interface TooltipProps {
  children: React.ReactNode;
  label: string;
  placement?: TooltipPlacement;
}

/**
 * Accessible hover/focus tooltip for scientific or domain terms.
 * Keeps the trigger readable while offering a plain-language explanation.
 * Respects reduced motion (no animation) via globals.css.
 */
export function Tooltip({ children, label, placement = "top" }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  const show = useCallback(() => setOpen(true), []);
  const hide = useCallback(() => setOpen(false), []);

  // Reposition the tooltip to stay near its anchor using the anchor's rect.
  const [style, setStyle] = useState<React.CSSProperties>({});

  const place = useCallback(() => {
    const anchor = anchorRef.current;
    const tip = tipRef.current;
    if (!anchor || !tip || !open) return;
    const rect = anchor.getBoundingClientRect();
    const { innerWidth: W, innerHeight: H } = window;
    const tipRect = tip.getBoundingClientRect();
    const pad = 10;
    let top = 0;
    let left = 0;
    let transform = "";

    const flipVertical = placement === "top" ? rect.top - tipRect.height - pad < 0 : false;
    const flipBottom = placement === "bottom" ? rect.bottom + tipRect.height + pad > H : false;

    if (placement === "top" && !flipVertical) {
      top = rect.top - tipRect.height - pad;
      left = rect.left + rect.width / 2 - tipRect.width / 2;
      transform = "translateX(-50%)";
    } else if (placement === "bottom" && !flipBottom) {
      top = rect.bottom + pad;
      left = rect.left + rect.width / 2 - tipRect.width / 2;
      transform = "translateX(-50%)";
    } else if (placement === "left") {
      top = rect.top + rect.height / 2 - tipRect.height / 2;
      left = rect.left - tipRect.width - pad;
      transform = "translateY(-50%)";
    } else {
      // right (fallback)
      top = rect.top + rect.height / 2 - tipRect.height / 2;
      left = rect.right + pad;
      transform = "translateY(-50%)";
    }

    // Clamp to viewport.
    left = Math.max(pad, Math.min(left, W - tipRect.width - pad));
    top = Math.max(pad, Math.min(top, H - tipRect.height - pad));

    setStyle({ top, left, transform, position: "fixed" });
  }, [open, placement]);

  useCallback(() => {
    if (open) place();
  }, [open, place]);

  return (
    <span
      ref={anchorRef}
      className="term"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      tabIndex={0}
      role="button"
      aria-label={label}
      aria-describedby={open ? "earth-pulse-tooltip" : undefined}
      aria-expanded={open}
      style={{ display: "inline-flex", alignItems: "center" }}
    >
      {children}
      {open && (
        <div
          ref={tipRef}
          id="earth-pulse-tooltip"
          role="tooltip"
          className={`tooltip tooltip--${placement}`}
          style={style}
        >
          {label}
        </div>
      )}
    </span>
  );
}
