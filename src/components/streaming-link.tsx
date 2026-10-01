"use client";

import type { ReactNode } from "react";
import { captureProductEvent } from "@/lib/analytics";
import type { StreamingSource } from "@/types/streaming";
import { launchStreamingWatchNow } from "@/lib/tv-streaming-launch";
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
        const platform = launchStreamingWatchNow({
          providerName: source.providerName,
          url: source.url,
          preferTvBehavior: isTv,
        });
        if (platform !== "browser" || isTv) {
          e.preventDefault();
        }
      }}
    >
      {children}
    </a>
  );
}
