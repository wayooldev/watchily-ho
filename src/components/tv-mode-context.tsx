"use client";

import { createContext, useContext, type ReactNode } from "react";

export type TvModeContextValue = {
  isTv: boolean;
  uiMode: "react" | "standalone";
  /** Prefer static UI; skip Framer Motion on TV */
  reduceMotion: boolean;
};

const TvModeContext = createContext<TvModeContextValue>({
  isTv: false,
  uiMode: "react",
  reduceMotion: false,
});

export function TvModeProvider({
  isTv,
  uiMode,
  children,
}: {
  isTv: boolean;
  uiMode: "react" | "standalone";
  children: ReactNode;
}) {
  const value: TvModeContextValue = {
    isTv,
    uiMode,
    reduceMotion: isTv,
  };
  return (
    <TvModeContext.Provider value={value}>{children}</TvModeContext.Provider>
  );
}

export function useTvMode(): TvModeContextValue {
  return useContext(TvModeContext);
}
