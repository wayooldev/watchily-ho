import { describe, expect, it } from "vitest";
import {
  keyToDirection,
  pickNextFocusable,
  pickTvNavSibling,
  resolveInitialFocusable,
} from "@/lib/tv-spatial-nav";

function fakeFocusable(
  id: string,
  left: number,
  top: number,
  flags: { initial?: boolean; nav?: boolean } = {},
): HTMLElement {
  return {
    id,
    getBoundingClientRect: () => ({
      left,
      top,
      width: 40,
      height: 20,
      right: left + 40,
      bottom: top + 20,
      x: left,
      y: top,
      toJSON() {
        return {};
      },
    }),
    hasAttribute: (name: string) => {
      if (name === "data-tv-initial-focus") return Boolean(flags.initial);
      if (name === "data-tv-nav") return Boolean(flags.nav);
      return false;
    },
  } as HTMLElement;
}

describe("tv-spatial-nav", () => {
  it("maps arrow keys to directions", () => {
    expect(keyToDirection("ArrowLeft")).toBe("left");
    expect(keyToDirection("ArrowRight")).toBe("right");
    expect(keyToDirection("ArrowUp")).toBe("up");
    expect(keyToDirection("ArrowDown")).toBe("down");
    expect(keyToDirection("Enter")).toBe(null);
  });

  it("picks the nearest neighbor in each direction", () => {
    const center = fakeFocusable("c", 100, 100);
    const left = fakeFocusable("l", 20, 100);
    const right = fakeFocusable("r", 180, 100);
    const up = fakeFocusable("u", 100, 20);
    const down = fakeFocusable("d", 100, 180);
    const candidates = [center, left, right, up, down];

    expect(pickNextFocusable(center, candidates, "left")?.id).toBe("l");
    expect(pickNextFocusable(center, candidates, "right")?.id).toBe("r");
    expect(pickNextFocusable(center, candidates, "up")?.id).toBe("u");
    expect(pickNextFocusable(center, candidates, "down")?.id).toBe("d");
  });

  it("resolves initial focus preferring data-tv-initial-focus", () => {
    const search = fakeFocusable("search", 0, 0, { nav: true });
    const library = fakeFocusable("library", 50, 0, {
      nav: true,
      initial: true,
    });
    expect(resolveInitialFocusable([search, library])?.id).toBe("library");
    expect(resolveInitialFocusable([search])?.id).toBe("search");
    expect(resolveInitialFocusable([])).toBe(null);
  });

  it("walks TV nav siblings left/right in DOM order", () => {
    const library = fakeFocusable("library", 0, 0, { nav: true });
    const search = fakeFocusable("search", 50, 0, { nav: true });
    const settings = fakeFocusable("settings", 100, 0, { nav: true });
    const nav = [library, search, settings];
    expect(pickTvNavSibling(library, nav, "right")?.id).toBe("search");
    expect(pickTvNavSibling(search, nav, "left")?.id).toBe("library");
    expect(pickTvNavSibling(settings, nav, "right")).toBe(null);
  });
});
