"use client";

import Script from "next/script";
import NextLink from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

function navClass(active: boolean) {
  return cn(
    // TV remote targets: large enough to focus, not oversized on desktop preview
    "inline-flex min-h-11 min-w-[5.5rem] items-center justify-center rounded-md px-4 py-2 text-base font-semibold transition-colors",
    "border border-white/15 bg-white/5 text-foreground",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
    active && "border-primary bg-primary/20 text-primary",
  );
}

export function TvChrome({ children }: { children: React.ReactNode }) {
  const t = useTranslations("tv");
  const locale = useLocale();
  const pathname = usePathname() ?? "";
  const pathNoLocale = pathname.replace(/^\/es(?=\/|$)/, "") || "/";
  const prefix = locale === "es" ? "/es" : "";

  const isLibrary =
    pathNoLocale === "/library" || pathNoLocale.startsWith("/lists/");
  const isSearch = pathNoLocale === "/search";
  const isSettings = pathNoLocale === "/settings";

  return (
    <div
      className="tv-chrome flex min-h-screen flex-col px-4 pt-3 pb-4 sm:px-6"
      style={{
        backgroundImage: `
          radial-gradient(ellipse 100% 60% at 50% -5%, rgba(56,120,255,0.45) 0%, transparent 68%),
          radial-gradient(ellipse 60% 50% at -5% 15%, rgba(130,60,220,0.25) 0%, transparent 65%),
          radial-gradient(ellipse 55% 45% at 105% 10%, rgba(20,160,220,0.22) 0%, transparent 60%),
          linear-gradient(180deg, #0b1120 0%, #080c18 30%, #060810 65%, #05070d 100%)
        `,
        backgroundAttachment: "fixed",
        paddingLeft: "max(1rem, env(safe-area-inset-left))",
        paddingRight: "max(1rem, env(safe-area-inset-right))",
        paddingTop: "max(0.75rem, env(safe-area-inset-top))",
        paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
      }}
    >
      <Script
        src="https://cdn.jsdelivr.net/npm/webostvjs@1.2.4/webOSTV.js"
        strategy="afterInteractive"
      />
      <header className="mb-4 flex flex-wrap items-center gap-3 border-b border-white/10 pb-3">
        <h1 className="mr-4 text-2xl font-bold tracking-tight text-primary sm:text-3xl">
          Watchily
        </h1>
        <nav className="flex flex-wrap items-center gap-2" aria-label="TV">
          <NextLink
            href={`${prefix}/library?device=tv`}
            className={navClass(isLibrary)}
            data-tv-nav
            data-tv-initial-focus
          >
            {t("library")}
          </NextLink>
          <NextLink
            href={`${prefix}/search?device=tv`}
            className={navClass(isSearch)}
            data-tv-nav
          >
            {t("search")}
          </NextLink>
          <NextLink
            href={`${prefix}/settings?device=tv`}
            className={navClass(isSettings)}
            data-tv-nav
          >
            {t("settings")}
          </NextLink>
          <form action="/auth/signout" method="POST" className="inline">
            <input type="hidden" name="redirect" value="/login?device=tv" />
            <button type="submit" className={navClass(false)} data-tv-nav>
              {t("signOut")}
            </button>
          </form>
        </nav>
      </header>
      <div className="mx-auto w-full max-w-7xl flex-1">{children}</div>
    </div>
  );
}
