import { describe, expect, it } from "vitest";
import {
  DEFAULT_TV_UI_MODE,
  isTvClient,
  isTvUserAgent,
  parseTvUiMode,
  resolveTvUiMode,
  shouldRewriteToStandalone,
  standaloneToReactPath,
} from "@/lib/tv-mode";

describe("tv-mode detection", () => {
  it("detects webOS and related TV user agents", () => {
    expect(isTvUserAgent("Mozilla/5.0 (Web0S; Linux/SmartTV)")).toBe(true);
    expect(isTvUserAgent("CrKey/1.0")).toBe(true);
    expect(isTvUserAgent("Mozilla/5.0 (Linux; Android 10) AppleWebKit")).toBe(
      false,
    );
  });

  it("treats device=tv as TV even on desktop UA", () => {
    expect(
      isTvClient({
        userAgent: "Mozilla/5.0",
        deviceParam: "tv",
      }),
    ).toBe(true);
  });
});

describe("tv-mode UI resolution", () => {
  it("defaults to react after cutover", () => {
    expect(DEFAULT_TV_UI_MODE).toBe("react");
    expect(resolveTvUiMode({})).toBe("react");
  });

  it("prefers query over env over default", () => {
    expect(
      resolveTvUiMode({
        queryMode: "standalone",
        envMode: "react",
      }),
    ).toBe("standalone");
    expect(resolveTvUiMode({ envMode: "standalone" })).toBe("standalone");
    expect(parseTvUiMode("nope")).toBe(null);
  });

  it("only rewrites to standalone when TV + standalone mode", () => {
    expect(
      shouldRewriteToStandalone({ isTv: true, uiMode: "standalone" }),
    ).toBe(true);
    expect(shouldRewriteToStandalone({ isTv: true, uiMode: "react" })).toBe(
      false,
    );
    expect(
      shouldRewriteToStandalone({ isTv: false, uiMode: "standalone" }),
    ).toBe(false);
  });
});

describe("standaloneToReactPath", () => {
  it("maps legacy standalone URLs to React routes", () => {
    expect(standaloneToReactPath("/tv-standalone")).toBe("/library");
    expect(standaloneToReactPath("/title-standalone/abc")).toBe("/title/abc");
    expect(standaloneToReactPath("/lists-standalone/xyz")).toBe("/lists/xyz");
    expect(standaloneToReactPath("/unknown")).toBe(null);
  });
});

describe("withTvDeviceQuery", () => {
  it("appends device=tv when needed", async () => {
    const { withTvDeviceQuery } = await import("@/lib/tv-mode");
    expect(withTvDeviceQuery("/login", "tv")).toBe("/login?device=tv");
    expect(withTvDeviceQuery("/login?next=1", "tv")).toBe(
      "/login?next=1&device=tv",
    );
    expect(withTvDeviceQuery("/login", null)).toBe("/login");
    expect(withTvDeviceQuery("/login?device=tv", "tv")).toBe(
      "/login?device=tv",
    );
  });
});
