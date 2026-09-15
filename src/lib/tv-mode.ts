/**
 * Shared TV client detection and UI mode (React vs legacy HTML standalone).
 * Safe for Edge middleware (no Node-only APIs).
 */

export const TV_UA_PATTERN =
  /webos|web0s|tizen|smart-?tv|netcast|webappmanager|hbbtv|vidaa|silk|crkey|googletv|android.?tv|apple.?tv|lg browser|aft[a-z0-9]/i;

export type TvUiMode = "react" | "standalone";

export const TV_CLIENT_COOKIE = "watchily_tv_client";
export const TV_UI_COOKIE = "watchily_tv_ui";

/** Default after cutover: React TV. Escape: ?tv_ui=standalone or TV_UI_MODE=standalone */
export const DEFAULT_TV_UI_MODE: TvUiMode = "react";

export function isTvUserAgent(userAgent: string | null | undefined): boolean {
  return TV_UA_PATTERN.test(userAgent ?? "");
}

export function isTvDeviceParam(device: string | null | undefined): boolean {
  return device === "tv";
}

export function isTvClient(options: {
  userAgent?: string | null;
  deviceParam?: string | null;
}): boolean {
  if (isTvDeviceParam(options.deviceParam)) return true;
  return isTvUserAgent(options.userAgent);
}

export function parseTvUiMode(
  value: string | null | undefined,
): TvUiMode | null {
  if (value === "react" || value === "standalone") return value;
  return null;
}

/**
 * Resolve UI mode: query `tv_ui` > env override > default.
 * `envMode` is typically `process.env.TV_UI_MODE`.
 */
export function resolveTvUiMode(options: {
  queryMode?: string | null;
  envMode?: string | null;
  defaultMode?: TvUiMode;
}): TvUiMode {
  const fromQuery = parseTvUiMode(options.queryMode);
  if (fromQuery) return fromQuery;
  const fromEnv = parseTvUiMode(options.envMode);
  if (fromEnv) return fromEnv;
  return options.defaultMode ?? DEFAULT_TV_UI_MODE;
}

export function shouldRewriteToStandalone(options: {
  isTv: boolean;
  uiMode: TvUiMode;
}): boolean {
  return options.isTv && options.uiMode === "standalone";
}

/** Append ?device=tv (or &device=tv) when the request is a TV client. */
export function withTvDeviceQuery(
  path: string,
  device?: string | null,
): string {
  if (device !== "tv") return path;
  if (path.includes("device=tv")) return path;
  return path.includes("?") ? `${path}&device=tv` : `${path}?device=tv`;
}

/** Map legacy standalone paths to React equivalents (pathname only). */
export function standaloneToReactPath(pathname: string): string | null {
  if (pathname === "/tv-standalone") return "/library";
  if (pathname === "/search-standalone") return "/search";
  if (pathname === "/lists-standalone") return "/library";
  if (pathname === "/lists-all-standalone") return "/library";
  if (pathname === "/settings-standalone") return "/settings";
  if (pathname === "/login-standalone") return "/login";
  const titleMatch = pathname.match(/^\/title-standalone\/([^/]+)\/?$/);
  if (titleMatch) return `/title/${titleMatch[1]}`;
  const listMatch = pathname.match(/^\/lists-standalone\/([^/]+)\/?$/);
  if (listMatch && listMatch[1] !== "create") return `/lists/${listMatch[1]}`;
  return null;
}
