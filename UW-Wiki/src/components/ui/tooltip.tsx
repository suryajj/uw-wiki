"use client";

import { useState, type ReactNode } from "react";

type Props = {
  label: string;
  children: ReactNode;
  /** Vertical position of the tooltip relative to the trigger. Defaults to "bottom". */
  side?: "top" | "bottom";
  className?: string;
};

/**
 * Minimal tooltip primitive. Wraps any trigger element and shows a small label
 * on hover/focus. Tailwind-only; no Radix dependency. Intended for icon-only
 * buttons so users can still discover what the action does.
 */
export function Tooltip({ label, children, side = "bottom", className }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <span
      className={`relative inline-flex ${className ?? ""}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      <span
        role="tooltip"
        aria-hidden={!open}
        className={
          "pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-[color:var(--surface-2)] px-2 py-1 text-xs text-foreground shadow-sm transition-opacity duration-150 " +
          (open ? "opacity-100" : "opacity-0") +
          " " +
          (side === "top" ? "bottom-full mb-2" : "top-full mt-2")
        }
      >
        {label}
      </span>
    </span>
  );
}
