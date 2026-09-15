import { Suspense } from "react";
import type { Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { AppProviders } from "@/components/app-providers";
import { PageTransition } from "@/components/page-transition";
import { JsonLd } from "@/components/seo/JsonLd";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { TvModeProvider } from "@/components/tv-mode-context";
import { TvChrome } from "@/components/tv-chrome";
import { TvSpatialRoot } from "@/components/tv-spatial-root";
import { webApplicationJsonLd } from "@/lib/seo/json-ld";
import { rootLayoutMetadata } from "@/lib/seo/metadata";
import {
  TV_CLIENT_COOKIE,
  TV_UI_COOKIE,
  isTvUserAgent,
  parseTvUiMode,
  type TvUiMode,
} from "@/lib/tv-mode";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = rootLayoutMetadata();

export const viewport: Viewport = {
  themeColor: "#0b1120",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

async function resolveTvShell(): Promise<{
  useTvShell: boolean;
  uiMode: TvUiMode;
}> {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const fromCookie = cookieStore.get(TV_CLIENT_COOKIE)?.value === "1";
  const uaTv = isTvUserAgent(headerStore.get("user-agent"));
  const isTv = fromCookie || uaTv;
  const uiMode = parseTvUiMode(cookieStore.get(TV_UI_COOKIE)?.value) ?? "react";
  return {
    useTvShell: isTv && uiMode === "react",
    uiMode,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();
  const { useTvShell, uiMode } = await resolveTvShell();

  return (
    <html
      lang={locale}
      className={`dark${useTvShell ? " tv-mode" : ""}`}
      suppressHydrationWarning
    >
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-background`}
      >
        <JsonLd data={webApplicationJsonLd()} />
        {!useTvShell && <ServiceWorkerRegister />}
        <NextIntlClientProvider messages={messages}>
          <AppProviders>
            <TvModeProvider isTv={useTvShell} uiMode={uiMode}>
              {useTvShell ? (
                <TvSpatialRoot>
                  <TvChrome>
                    <PageTransition>{children}</PageTransition>
                  </TvChrome>
                </TvSpatialRoot>
              ) : (
                <div className="flex min-h-screen flex-col">
                  <Suspense
                    fallback={
                      <header className="h-16 border-b border-white/8 bg-zinc-900/95" />
                    }
                  >
                    <Header />
                  </Suspense>
                  <div className="flex-1">
                    <PageTransition>{children}</PageTransition>
                  </div>
                  <Footer />
                </div>
              )}
            </TvModeProvider>
          </AppProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
