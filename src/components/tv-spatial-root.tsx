"use client";

import { useEffect, useRef, type ReactNode } from "react";
import {
  collectTvFocusables,
  keyToDirection,
  pickNextFocusable,
  pickTvNavSibling,
  resolveInitialFocusable,
} from "@/lib/tv-spatial-nav";

/**
 * Lightweight TV remote focus (no third-party spatial-nav).
 * Avoids norigin measureLayout crashes under React 19 / Next Turbopack.
 */
export function TvSpatialRoot({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const focusInitial = () => {
      const active = document.activeElement;
      if (active instanceof HTMLElement && root.contains(active)) {
        return;
      }
      const focusables = collectTvFocusables(root);
      const next = resolveInitialFocusable(focusables);
      if (next) {
        try {
          next.focus({ preventScroll: false });
        } catch {
          next.focus();
        }
      }
    };

    const t1 = window.setTimeout(focusInitial, 50);
    const t2 = window.setTimeout(focusInitial, 300);
    const t3 = window.setTimeout(focusInitial, 800);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const direction = keyToDirection(event.key);
      const active = document.activeElement;

      if (
        event.key === "Enter" &&
        active instanceof HTMLElement &&
        root.contains(active)
      ) {
        // Native links/buttons already activate; ensure buttons without type still fire.
        if (
          active.tagName === "BUTTON" ||
          active.getAttribute("role") === "button"
        ) {
          event.preventDefault();
          active.click();
        }
        return;
      }

      if (!direction) return;
      if (!(active instanceof HTMLElement) || !root.contains(active)) {
        focusInitial();
        event.preventDefault();
        return;
      }

      // Let inputs keep caret movement on left/right when not at edge is complex;
      // for TV we still move focus on arrows from inputs (remote UX).
      const focusables = collectTvFocusables(root);
      const navItems = focusables.filter((el) =>
        el.hasAttribute("data-tv-nav"),
      );
      let next: HTMLElement | null = null;
      if (
        (direction === "left" || direction === "right") &&
        active.hasAttribute("data-tv-nav")
      ) {
        next = pickTvNavSibling(active, navItems, direction);
      }
      if (!next) {
        next = pickNextFocusable(active, focusables, direction);
      }
      if (next) {
        event.preventDefault();
        next.focus();
      }
    };

    // Listen on document so arrow keys work with native focus on links/inputs.
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className="tv-spatial-root min-h-screen outline-none"
      data-tv-spatial-root
    >
      {children}
    </div>
  );
}
