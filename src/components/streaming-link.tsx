"use client";

import type { ReactNode } from "react";
import { captureProductEvent } from "@/lib/analytics";
import type { StreamingSource } from "@/types/streaming";
import {
  isWebOSEnvironment,
  launchStreamingOnWebOS,
  resolveWebOSAppId,
} from "@/lib/webos-launch";
import { useTvMode } from "@/components/tv-mode-context";

export function StreamingLink({
  source,
  className,
  children,
}: {
  source: Pick<StreamingSource, "providerName" | "type" | "url">;
  className?: string;
  children: ReactNode;
}) {
  const { isTv } = useTvMode();
  const url = source.url ?? "#";

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={(e) => {
        if (source.url) {
          captureProductEvent("streaming_link_clicked", {
            provider: source.providerName,
            offerType: source.type,
          });
        }
        if (!source.url || source.url === "#") return;
        if (isTv || isWebOSEnvironment()) {
          e.preventDefault();
          launchStreamingOnWebOS({
            appId: resolveWebOSAppId(source.providerName),
            url: source.url,
          });
        }
      }}
    >
      {children}
    </a>
  );
}
