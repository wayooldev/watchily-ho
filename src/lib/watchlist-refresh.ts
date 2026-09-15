import { createAdminClient } from "@/lib/supabase/server";
import {
  getTitleDetails,
  isCachedAvailabilityUsable,
  isLibraryTitleHydrated,
} from "@/lib/streaming/unified";
import type { UnifiedTitle } from "@/types/streaming";

const DEFAULT_COUNTRY = "MX";

function isUnifiedTitle(value: unknown): value is UnifiedTitle {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    (v.type === "movie" || v.type === "series")
  );
}

export async function refreshTitleAvailabilityCache(
  titleId: string,
  countryCode = DEFAULT_COUNTRY,
): Promise<{ titleId: string; ok: boolean; skipped?: boolean }> {
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("title_availability_cache")
    .select("refreshed_at, payload")
    .eq("title_id", titleId)
    .eq("country_code", countryCode)
    .maybeSingle();

  if (
    existing &&
    isUnifiedTitle(existing.payload) &&
    isCachedAvailabilityUsable(
      existing.payload,
      countryCode,
      existing.refreshed_at,
    )
  ) {
    return { titleId, ok: true, skipped: true };
  }

  const detail = await getTitleDetails(titleId, {
    country: countryCode,
    region: countryCode,
  });
  if (!detail || !isLibraryTitleHydrated(detail)) {
    return { titleId, ok: false };
  }

  const { error } = await admin.from("title_availability_cache").upsert(
    {
      title_id: titleId,
      country_code: countryCode,
      payload: detail,
      refreshed_at: new Date().toISOString(),
    },
    { onConflict: "title_id,country_code" },
  );

  if (error) {
    console.error("[watchlist/refresh]", titleId, error.message);
    return { titleId, ok: false };
  }

  return { titleId, ok: true };
}
