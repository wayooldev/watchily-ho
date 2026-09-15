import { describe, expect, it } from "vitest";
import { resolveWebOSAppId, WEBOS_APP_IDS_BY_BRAND } from "@/lib/webos-launch";

describe("resolveWebOSAppId", () => {
  it("maps canonical brands", () => {
    expect(resolveWebOSAppId("Netflix")).toBe(WEBOS_APP_IDS_BY_BRAND.netflix);
    expect(resolveWebOSAppId("Disney+")).toBe(
      WEBOS_APP_IDS_BY_BRAND.disney_plus,
    );
    expect(resolveWebOSAppId("Max")).toBe(WEBOS_APP_IDS_BY_BRAND.hbo_max);
  });

  it("falls back on fuzzy provider names", () => {
    expect(resolveWebOSAppId("Amazon Prime Video")).toBe("amazon");
    expect(resolveWebOSAppId("Crunchyroll")).toBe("com.crunchyroll.crmay");
  });

  it("returns undefined for unknown providers", () => {
    expect(resolveWebOSAppId("Some Indie Stream")).toBe(undefined);
  });
});
