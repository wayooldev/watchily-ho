import { z } from "zod";
import { after } from "next/server";
import { getSupabaseAndUser, createAdminClient } from "@/lib/supabase/server";
import {
  getTitleDetails,
  isCachedAvailabilityUsable,
  isLibraryTitleHydrated,
} from "@/lib/streaming/unified";
import { invalidateLibraryCatalog } from "@/lib/library-cache";
import type { UnifiedTitle } from "@/types/streaming";

const BodySchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(24),
  country: z.string().min(2).max(2).optional(),
});

const DEFAULT_COUNTRY = "MX";

type CacheRow = {
  title_id: string;
  payload: unknown;
  refreshed_at?: string | null;
};

function isUnifiedTitle(value: unknown): value is UnifiedTitle {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    (v.type === "movie" || v.type === "series")
  );
}

export async function POST(request: Request) {
  const { user } = await getSupabaseAndUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const country = (parsed.data.country ?? DEFAULT_COUNTRY).toUpperCase();
  const ids = [...new Set(parsed.data.ids)];

  const admin = createAdminClient();
  const { data: cachedRaw, error: cacheError } = await admin
    .from("title_availability_cache")
    .select("title_id, payload, refreshed_at")
    .eq("country_code", country)
    .in("title_id", ids);

  if (cacheError) {
    return Response.json({ error: cacheError.message }, { status: 500 });
  }

  const cached = (cachedRaw ?? []) as CacheRow[];
  const byId = new Map<string, UnifiedTitle>();

  for (const row of cached) {
    if (
      isUnifiedTitle(row.payload) &&
      isCachedAvailabilityUsable(row.payload, country, row.refreshed_at)
    ) {
      byId.set(row.title_id, row.payload);
    }
  }

  const missing = ids.filter((id) => !byId.has(id));

  const enrichOne = async (id: string) => {
    const detail = await getTitleDetails(id, {
      country,
      region: country,
    });
    if (!detail || !isLibraryTitleHydrated(detail)) return null;
    const { error } = await admin.from("title_availability_cache").upsert(
      {
        title_id: id,
        country_code: country,
        payload: detail,
        refreshed_at: new Date().toISOString(),
      },
      { onConflict: "title_id,country_code" },
    );
    if (error) throw error;
    return { id, detail };
  };

  const enriched: PromiseSettledResult<
    Awaited<ReturnType<typeof enrichOne>>
  >[] = [];
  for (let i = 0; i < missing.length; i += 4) {
    enriched.push(
      ...(await Promise.allSettled(missing.slice(i, i + 4).map(enrichOne))),
    );
  }

  let enrichedCount = 0;
  for (const result of enriched) {
    if (result.status === "fulfilled" && result.value) {
      byId.set(result.value.id, result.value.detail);
      enrichedCount += 1;
    } else if (result.status === "rejected") {
      console.error("[library/enrich]", result.reason);
    }
  }
  if (enrichedCount > 0) {
    after(() => invalidateLibraryCatalog(user.id, country));
  }

  const titles = ids
    .map((id) => byId.get(id))
    .filter((t): t is UnifiedTitle => Boolean(t));

  return Response.json({ titles });
}
