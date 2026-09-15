export type TvNavDirection = "up" | "down" | "left" | "right";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function isElementVisible(el: HTMLElement): boolean {
  if (el.getAttribute("aria-hidden") === "true") return false;
  const style =
    typeof window !== "undefined" ? window.getComputedStyle(el) : null;
  if (style && (style.visibility === "hidden" || style.display === "none")) {
    return false;
  }
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

export function collectTvFocusables(root: ParentNode): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((el) => isElementVisible(el));
}

function centerOf(el: HTMLElement): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/**
 * Pick the best focusable neighbor in a direction using spatial geometry.
 * Pure enough to unit-test with mock getBoundingClientRect via real DOM in jsdom.
 */
export function pickNextFocusable(
  current: HTMLElement,
  candidates: HTMLElement[],
  direction: TvNavDirection,
): HTMLElement | null {
  const origin = centerOf(current);
  let best: HTMLElement | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    if (candidate === current) continue;
    const c = centerOf(candidate);
    const dx = c.x - origin.x;
    const dy = c.y - origin.y;

    let inDirection = false;
    let primary = 0;
    let secondary = 0;

    switch (direction) {
      case "left":
        inDirection = dx < -2;
        primary = -dx;
        secondary = Math.abs(dy);
        break;
      case "right":
        inDirection = dx > 2;
        primary = dx;
        secondary = Math.abs(dy);
        break;
      case "up":
        inDirection = dy < -2;
        primary = -dy;
        secondary = Math.abs(dx);
        break;
      case "down":
        inDirection = dy > 2;
        primary = dy;
        secondary = Math.abs(dx);
        break;
      default: {
        const _exhaustive: never = direction;
        return _exhaustive;
      }
    }

    if (!inDirection) continue;
    // Prefer closer along the axis; penalize off-axis drift.
    const score = primary + secondary * 2;
    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return best;
}

export function keyToDirection(key: string): TvNavDirection | null {
  switch (key) {
    case "ArrowLeft":
      return "left";
    case "ArrowRight":
      return "right";
    case "ArrowUp":
      return "up";
    case "ArrowDown":
      return "down";
    default:
      return null;
  }
}

export function resolveInitialFocusable(
  focusables: HTMLElement[],
): HTMLElement | null {
  const marked = focusables.find((el) =>
    el.hasAttribute("data-tv-initial-focus"),
  );
  if (marked) return marked;
  const nav = focusables.find((el) => el.hasAttribute("data-tv-nav"));
  return nav ?? focusables[0] ?? null;
}

/** Prefer ordered nav strip for left/right when the current control is a TV nav item. */
export function pickTvNavSibling(
  current: HTMLElement,
  navItems: HTMLElement[],
  direction: Extract<TvNavDirection, "left" | "right">,
): HTMLElement | null {
  const idx = navItems.indexOf(current);
  if (idx < 0) return null;
  if (direction === "right") return navItems[idx + 1] ?? null;
  return navItems[idx - 1] ?? null;
}
