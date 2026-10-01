import { describe, expect, it, vi, afterEach } from "vitest";
import {
  resolveTizenAppId,
  TIZEN_APP_IDS_BY_BRAND,
  launchStreamingOnTizen,
  isTizenEnvironment,
} from "@/lib/tizen-launch";
import {
  detectTvLaunchPlatform,
  launchStreamingWatchNow,
} from "@/lib/tv-streaming-launch";
import { resolveWebOSAppId, WEBOS_APP_IDS_BY_BRAND } from "@/lib/webos-launch";

describe("resolveTizenAppId", () => {
  it("maps canonical brands", () => {
    expect(resolveTizenAppId("Netflix")).toBe(TIZEN_APP_IDS_BY_BRAND.netflix);
    expect(resolveTizenAppId("Disney+")).toBe(
      TIZEN_APP_IDS_BY_BRAND.disney_plus,
    );
    expect(resolveTizenAppId("Max")).toBe(TIZEN_APP_IDS_BY_BRAND.hbo_max);
  });

  it("falls back on fuzzy provider names", () => {
    expect(resolveTizenAppId("Amazon Prime Video")).toBe(
      TIZEN_APP_IDS_BY_BRAND.amazon_prime,
    );
  });

  it("returns undefined for unknown providers", () => {
    expect(resolveTizenAppId("Some Indie Stream")).toBe(undefined);
  });
});

describe("detectTvLaunchPlatform", () => {
  const originalWindow = globalThis.window;

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalWindow) {
      // restore handled by vitest env
    }
  });

  it("returns browser when no OEM APIs", () => {
    vi.stubGlobal("window", {
      navigator: { userAgent: "Mozilla/5.0" },
    });
    expect(detectTvLaunchPlatform()).toBe("browser");
  });

  it("detects tizen from API", () => {
    vi.stubGlobal("window", {
      navigator: { userAgent: "Mozilla/5.0" },
      tizen: {
        ApplicationControl: class {},
        application: { launchAppControl: () => {} },
      },
    });
    expect(detectTvLaunchPlatform()).toBe("tizen");
  });

  it("detects webos from API", () => {
    vi.stubGlobal("window", {
      navigator: { userAgent: "Mozilla/5.0" },
      webOS: { service: { request: () => {} } },
    });
    expect(detectTvLaunchPlatform()).toBe("webos");
  });
});

describe("launchStreamingOnTizen", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("falls back to window.open when tizen missing", () => {
    const open = vi.fn();
    vi.stubGlobal("window", { open });
    expect(
      launchStreamingOnTizen({
        appId: TIZEN_APP_IDS_BY_BRAND.netflix,
        url: "https://www.netflix.com/title/1",
      }),
    ).toBe(false);
    expect(open).toHaveBeenCalled();
  });

  it("calls launchAppControl when tizen present", () => {
    const launchAppControl = vi.fn();
    class ApplicationControl {
      operation: string;
      uri: string | null;
      constructor(
        operation: string,
        uri?: string | null,
        _mime?: unknown,
        _cat?: unknown,
        _data?: unknown,
      ) {
        this.operation = operation;
        this.uri = uri ?? null;
      }
    }
    vi.stubGlobal("window", {
      open: vi.fn(),
      tizen: {
        ApplicationControl,
        application: { launchAppControl },
      },
    });
    expect(isTizenEnvironment()).toBe(true);
    expect(
      launchStreamingOnTizen({
        appId: TIZEN_APP_IDS_BY_BRAND.netflix,
        url: "https://www.netflix.com/title/1",
      }),
    ).toBe(true);
    expect(launchAppControl).toHaveBeenCalled();
  });
});

describe("launchStreamingWatchNow", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens URL on preferTvBehavior without OEM APIs", () => {
    const open = vi.fn();
    vi.stubGlobal("window", {
      open,
      navigator: { userAgent: "Mozilla/5.0" },
    });
    const platform = launchStreamingWatchNow({
      providerName: "Netflix",
      url: "https://www.netflix.com/title/1",
      preferTvBehavior: true,
    });
    expect(platform).toBe("browser");
    expect(open).toHaveBeenCalledWith(
      "https://www.netflix.com/title/1",
      "_blank",
    );
  });

  it("maps webOS brands consistently with resolveWebOSAppId", () => {
    expect(resolveWebOSAppId("Netflix")).toBe(WEBOS_APP_IDS_BY_BRAND.netflix);
  });
});
