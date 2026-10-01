import {
  isWebOSEnvironment,
  launchStreamingOnWebOS,
  resolveWebOSAppId,
} from "@/lib/webos-launch";
import {
  isTizenEnvironment,
  launchStreamingOnTizen,
  resolveTizenAppId,
} from "@/lib/tizen-launch";

export type TvLaunchPlatform = "webos" | "tizen" | "browser";

export function detectTvLaunchPlatform(): TvLaunchPlatform {
  if (typeof window === "undefined") return "browser";
  if (isWebOSEnvironment()) return "webos";
  if (isTizenEnvironment()) return "tizen";
  const ua = navigator.userAgent || "";
  if (/webos|web0s/i.test(ua)) return "webos";
  if (/tizen/i.test(ua)) return "tizen";
  return "browser";
}

/**
 * Watch now: open the native provider app on packaged TV shells when possible;
 * otherwise open the streaming URL in a browser tab.
 * Never navigates the Watchily WebView via location.assign (avoids black screens).
 */
export function launchStreamingWatchNow(options: {
  providerName: string | null | undefined;
  url: string;
  /** Force TV path even without OEM APIs (uses browser open as fallback). */
  preferTvBehavior?: boolean;
}): TvLaunchPlatform {
  const { providerName, url, preferTvBehavior } = options;
  if (!url || url === "#") return "browser";

  const platform = detectTvLaunchPlatform();

  if (platform === "webos") {
    launchStreamingOnWebOS({
      appId: resolveWebOSAppId(providerName),
      url,
    });
    return "webos";
  }

  if (platform === "tizen") {
    launchStreamingOnTizen({
      appId: resolveTizenAppId(providerName),
      url,
    });
    return "tizen";
  }

  if (preferTvBehavior) {
    // Desktop ?device=tv or TV UA without OEM bridge: open URL, do not throw.
    if (typeof window !== "undefined") {
      window.open(url, "_blank");
    }
  }

  return "browser";
}
