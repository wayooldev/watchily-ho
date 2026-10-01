import { canonicalProviderId } from "@/lib/streaming/providers";

/** Known Samsung Tizen application ids by canonical provider brand (verify on device). */
export const TIZEN_APP_IDS_BY_BRAND: Record<string, string> = {
  netflix: "org.tizen.netflix-app",
  disney_plus: "HOh3FT9SBL.DisneyPlus",
  hbo_max: "3s5yv8f6r4.Max",
  amazon_prime: "org.tizen.primevideo",
  youtube: "9Ur5IzDKqV.TizenYouTube",
  apple_tv_plus: "com.apple.appletv",
  paramount_plus: "MCmYJCk9QJ.ParamountPlus",
};

export function resolveTizenAppId(
  providerName: string | null | undefined,
): string | undefined {
  const brand = canonicalProviderId(providerName ?? "");
  if (TIZEN_APP_IDS_BY_BRAND[brand]) return TIZEN_APP_IDS_BY_BRAND[brand];
  const raw = (providerName ?? "").toLowerCase().trim();
  if (raw.includes("netflix")) return TIZEN_APP_IDS_BY_BRAND.netflix;
  if (raw.includes("disney")) return TIZEN_APP_IDS_BY_BRAND.disney_plus;
  if (raw.includes("hbo") || raw.includes("max"))
    return TIZEN_APP_IDS_BY_BRAND.hbo_max;
  if (raw.includes("prime") || raw.includes("amazon"))
    return TIZEN_APP_IDS_BY_BRAND.amazon_prime;
  if (raw.includes("youtube")) return TIZEN_APP_IDS_BY_BRAND.youtube;
  if (raw.includes("paramount")) return TIZEN_APP_IDS_BY_BRAND.paramount_plus;
  return undefined;
}

type TizenApplicationControlData = {
  key: string;
  value: string[];
};

type TizenApplicationControl = {
  operation: string;
  uri?: string | null;
  mime?: string | null;
  category?: string | null;
  data?: TizenApplicationControlData[] | null;
  appControl?: unknown;
};

type TizenApplication = {
  launchAppControl: (
    appControl: TizenApplicationControl,
    appId: string | null,
    successCallback?: () => void,
    errorCallback?: (err: { name?: string; message?: string }) => void,
  ) => void;
};

type TizenApi = {
  ApplicationControl: new (
    operation: string,
    uri?: string | null,
    mime?: string | null,
    category?: string | null,
    data?: TizenApplicationControlData[] | null,
  ) => TizenApplicationControl;
  application: TizenApplication;
};

function getTizen(): TizenApi | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & { tizen?: TizenApi };
  if (!w.tizen?.application?.launchAppControl || !w.tizen.ApplicationControl) {
    return null;
  }
  return w.tizen;
}

export function isTizenEnvironment(): boolean {
  return getTizen() != null;
}

function openUrlFallback(url: string): void {
  if (typeof window !== "undefined") {
    window.open(url, "_blank");
  }
}

/**
 * Launch a native streaming app on Tizen via ApplicationControl.
 * Passes the content URL as URI when available. Falls back to browser URL.
 */
export function launchStreamingOnTizen(options: {
  appId: string | undefined;
  url: string;
}): boolean {
  const { appId, url } = options;
  const tizen = getTizen();
  if (!tizen) {
    openUrlFallback(url);
    return false;
  }

  const onFail = () => openUrlFallback(url);

  try {
    if (!appId) {
      const browse = new tizen.ApplicationControl(
        "http://tizen.org/appcontrol/operation/view",
        url,
        null,
        null,
        null,
      );
      tizen.application.launchAppControl(browse, null, undefined, onFail);
      return true;
    }

    const appControl = new tizen.ApplicationControl(
      "http://tizen.org/appcontrol/operation/view",
      url || null,
      null,
      null,
      url
        ? [{ key: "PAYLOAD", value: [JSON.stringify({ values: url })] }]
        : null,
    );
    tizen.application.launchAppControl(appControl, appId, undefined, () => {
      // Retry launch without URI if content targeting fails
      try {
        const bare = new tizen.ApplicationControl(
          "http://tizen.org/appcontrol/operation/view",
          null,
          null,
          null,
          null,
        );
        tizen.application.launchAppControl(bare, appId, undefined, onFail);
      } catch {
        onFail();
      }
    });
    return true;
  } catch {
    openUrlFallback(url);
    return false;
  }
}
