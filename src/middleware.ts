import * as Sentry from "@sentry/nextjs";
import createMiddleware from "next-intl/middleware";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { routing } from "@/i18n/routing";
import { env } from "@/env";
import {
  TV_CLIENT_COOKIE,
  TV_UI_COOKIE,
  isTvClient,
  resolveTvUiMode,
  shouldRewriteToStandalone,
  standaloneToReactPath,
  type TvUiMode,
} from "@/lib/tv-mode";

const intlMiddleware = createMiddleware(routing);
const NON_LOCALIZED_PATH =
  /^\/(?:api(?:\/|$)|auth(?:\/|$)|api-docs(?:\/|$)|tv-standalone(?:\/|$)|search-standalone(?:\/|$)|lists-standalone(?:\/|$)|lists-all-standalone(?:\/|$)|title-standalone(?:\/|$)|settings-standalone(?:\/|$)|login-standalone(?:\/|$)|manifest\.webmanifest$|robots\.txt$|sitemap\.xml$|apple-icon$|icons(?:\/|$))/;

const COOKIE_OPTS = {
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
  sameSite: "lax" as const,
};

function attachTvCookies(response: NextResponse, uiMode: TvUiMode) {
  response.cookies.set(TV_CLIENT_COOKIE, "1", COOKIE_OPTS);
  response.cookies.set(TV_UI_COOKIE, uiMode, COOKIE_OPTS);
  return response;
}

function standaloneRewriteTarget(path: string): string | null {
  if (path === "/tv" || path === "/" || path === "/es" || path === "/es/tv")
    return "/tv-standalone";
  if (path === "/search" || path === "/es/search") return "/search-standalone";
  if (path === "/lists" || path === "/es/lists") return "/lists-standalone";
  if (path === "/lists/all" || path === "/es/lists/all")
    return "/lists-all-standalone";
  if (path.match(/^\/(?:es\/)?lists\/[^/]+$/))
    return path.replace(/\/lists\//, "/lists-standalone/").replace(/^\/es/, "");
  if (path.match(/^\/(?:es\/)?title\/([^/]+)$/))
    return path.replace(/\/title\//, "/title-standalone/").replace(/^\/es/, "");
  if (path === "/login" || path === "/es/login") return "/login-standalone";
  if (path === "/settings" || path === "/es/settings")
    return "/settings-standalone";
  return null;
}

async function getTvAuthUser(request: NextRequest) {
  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {
          /* no-op: cookies refreshed via updateSession later */
        },
      },
    },
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isTv = isTvClient({
    userAgent: request.headers.get("user-agent"),
    deviceParam: request.nextUrl.searchParams.get("device"),
  });
  const uiMode = resolveTvUiMode({
    queryMode: request.nextUrl.searchParams.get("tv_ui"),
    envMode: process.env.TV_UI_MODE,
  });

  const reactFromStandalone = standaloneToReactPath(path);
  if (reactFromStandalone && (!isTv || uiMode === "react")) {
    const url = request.nextUrl.clone();
    url.pathname = reactFromStandalone;
    if (isTv) url.searchParams.set("device", "tv");
    const redirect = NextResponse.redirect(url);
    if (isTv) attachTvCookies(redirect, uiMode);
    return redirect;
  }

  // `/tv` is always the hosted-app entry — force React TV routing even on desktop browsers.
  const isTvEntry = path === "/tv" || path === "/es/tv";
  const treatAsTv = isTv || isTvEntry;

  if (treatAsTv) {
    Sentry.setTag("platform", "webos");
    Sentry.setTag("tv_ui", uiMode);

    if (shouldRewriteToStandalone({ isTv: true, uiMode })) {
      const rewritePath = standaloneRewriteTarget(path);
      if (rewritePath) {
        const url = new URL(rewritePath, request.url);
        url.search = request.nextUrl.search;
        const rewrite = NextResponse.rewrite(url);
        return attachTvCookies(rewrite, uiMode);
      }
    } else if (isTvEntry || ((path === "/" || path === "/es") && isTv)) {
      const user = await getTvAuthUser(request);
      const url = request.nextUrl.clone();
      const es = path.startsWith("/es");
      if (user) {
        url.pathname = es ? "/es/library" : "/library";
      } else {
        url.pathname = es ? "/es/login" : "/login";
      }
      url.searchParams.set("device", "tv");
      if (!url.searchParams.get("tv_ui")) {
        url.searchParams.set("tv_ui", uiMode);
      }
      const redirect = NextResponse.redirect(url);
      return attachTvCookies(redirect, uiMode);
    }
  }

  if (NON_LOCALIZED_PATH.test(path)) {
    const session = await updateSession(request);
    if (treatAsTv) attachTvCookies(session, uiMode);
    return session;
  }

  const intlResponse = intlMiddleware(request);
  if (intlResponse.headers.has("location")) {
    if (treatAsTv) attachTvCookies(intlResponse, uiMode);
    return intlResponse;
  }

  const sessionResponse = await updateSession(request);
  for (const cookie of intlResponse.cookies.getAll()) {
    sessionResponse.cookies.set(cookie);
  }
  if (treatAsTv) attachTvCookies(sessionResponse, uiMode);
  return sessionResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
