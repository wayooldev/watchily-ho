import { canonicalProviderId } from "@/lib/streaming/providers";

/** Known webOS applicationManager app ids by canonical provider brand. */
export const WEBOS_APP_IDS_BY_BRAND: Record<string, string> = {
  netflix: "netflix",
  disney_plus: "com.disney.disneyplus-prod",
  hbo_max: "com.wbd.max",
  amazon_prime: "amazon",
  crunchyroll: "com.crunchyroll.crmay",
  paramount_plus: "com.paramount.paramountplus",
  apple_tv_plus: "com.apple.appletv",
};

export function resolveWebOSAppId(
  providerName: string | null | undefined,
): string | undefined {
  const brand = canonicalProviderId(providerName ?? "");
  if (WEBOS_APP_IDS_BY_BRAND[brand]) return WEBOS_APP_IDS_BY_BRAND[brand];
  const raw = (providerName ?? "").toLowerCase().trim();
  if (raw.includes("crunchy")) return "com.crunchyroll.crmay";
  if (raw.includes("paramount")) return "com.paramount.paramountplus";
  if (raw.includes("hbo") || raw.includes("max")) return "com.wbd.max";
  if (raw.includes("disney")) return "com.disney.disneyplus-prod";
  if (raw.includes("netflix")) return "netflix";
  if (raw.includes("prime") || raw.includes("amazon")) return "amazon";
  return undefined;
}

type WebOSService = {
  request: (
    uri: string,
    options: {
      method: string;
      parameters: Record<string, unknown>;
      onSuccess?: () => void;
      onFailure?: () => void;
    },
  ) => void;
};

function getWebOSService(): WebOSService | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    webOS?: { service?: WebOSService };
  };
  return w.webOS?.service ?? null;
}

export function openInWebOSBrowser(url: string): void {
  const service = getWebOSService();
  if (service) {
    try {
      service.request("luna://com.webos.applicationManager", {
        method: "launch",
        parameters: {
          id: "com.webos.app.browser",
          params: { url },
        },
      });
      return;
    } catch {
      /* fall through */
    }
  }
  if (typeof window !== "undefined") {
    window.open(url, "_blank");
  }
}

/**
 * Try launching a native streaming app on webOS; fall back to browser URL.
 * Returns true if a native launch was attempted.
 */
export function launchStreamingOnWebOS(options: {
  appId: string | undefined;
  url: string;
}): boolean {
  const { appId, url } = options;
  const service = getWebOSService();
  if (!appId || !service) {
    openInWebOSBrowser(url);
    return false;
  }
  try {
    service.request("luna://com.webos.applicationManager", {
      method: "launch",
      parameters: {
        id: appId,
        contentTarget: url,
        params: { contentTarget: url },
      },
      onFailure: () => openInWebOSBrowser(url),
    });
    return true;
  } catch {
    openInWebOSBrowser(url);
    return false;
  }
}

export function isWebOSEnvironment(): boolean {
  return getWebOSService() != null;
}
