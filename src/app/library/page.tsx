import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { after } from "next/server";
import { LibraryContent } from "@/components/library-content";
import type { LibraryPrefs, ListSection, StatusMap } from "@/types/library";
import type { TitleType, UnifiedTitle } from "@/types/streaming";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { localizedPath } from "@/i18n/routing";
import {
  readLibraryCatalog,
  readLibraryStatuses,
  writeLibraryCatalog,
  writeLibraryStatuses,
  type LibraryCatalogCache,
} from "@/lib/library-cache";
import { withTvDeviceQuery } from "@/lib/tv-mode";
import { isAvailabilityPayloadRegionCorrect } from "@/lib/streaming/unified";

export type { ListSection } from "@/types/library";

const CACHE_COUNTRY = "MX";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("metadata");
  return buildPageMetadata({
    title: t("library"),
    pathname: "/library",
    locale,
    noIndex: true,
  });
}

function normalizePrefs(
  row: {
    library_status_filter: string | null;
    library_title_sort: string | null;
  } | null,
): LibraryPrefs {
  const statusFilter =
    row?.library_status_filter === "watching" ||
    row?.library_status_filter === "finished"
      ? row.library_status_filter
      : "all";
  const titleSort =
    row?.library_title_sort === "asc" || row?.library_title_sort === "desc"
      ? row.library_title_sort
      : "custom";
  return { statusFilter, titleSort };
}

function stubTitle(id: string, titleType: string): UnifiedTitle {
  const type: TitleType = titleType === "series" ? "series" : "movie";
  return {
    id,
    name: "",
    type,
    // undefined sources = pending enrich (keep visible in library)
    sources: undefined,
  };
}

/** Drop wrong-region Watch now links and re-queue enrich (e.g. Watchmode US under MX). */
function scrubCatalogForCountry(
  catalog: LibraryCatalogCache,
  country: string,
): LibraryCatalogCache {
  const pending = new Set(catalog.pendingTitleIds);
  let changed = false;
  const sections = catalog.sections.map((section) => ({
    ...section,
    titles: section.titles.map((title) => {
      if (isAvailabilityPayloadRegionCorrect(title, country)) return title;
      changed = true;
      pending.add(title.id);
      return {
        ...title,
        sources: undefined,
        availabilitySource: undefined,
      };
    }),
  }));
  if (!changed && pending.size === catalog.pendingTitleIds.length) {
    return catalog;
  }
  return { sections, pendingTitleIds: [...pending] };
}

async function LibraryData({ userId }: { userId: string }) {
  const supabase = await createClient();
  const user = { id: userId };

  const statusPromise = readLibraryStatuses(user.id).then(async (cached) => {
    if (cached) return { cached, statusMap: cached.statusMap };
    const { data: statusRows } = await supabase
      .from("user_title_statuses")
      .select("title_id, status")
      .eq("user_id", user.id);
    const statusMap: StatusMap = {};
    for (const row of statusRows ?? []) {
      if (row.status === "watching" || row.status === "finished") {
        statusMap[row.title_id] = row.status;
      }
    }
    return { cached: null, statusMap };
  });
  const [providerResult, prefsResult, statusResult, cachedCatalog] =
    await Promise.all([
      supabase
        .from("user_providers")
        .select("provider_id")
        .eq("user_id", user.id),
      supabase
        .from("profiles")
        .select("library_status_filter, library_title_sort")
        .eq("id", user.id)
        .single(),
      statusPromise,
      readLibraryCatalog(user.id, CACHE_COUNTRY),
    ]);
  const providerRows = providerResult.data;
  const userProviderIds = (providerRows ?? []).map((r) => r.provider_id);

  const { statusMap } = statusResult;
  if (!statusResult.cached) {
    after(() => writeLibraryStatuses(user.id, { statusMap }));
  }

  const prefs = normalizePrefs(prefsResult.data);

  if (cachedCatalog) {
    const scrubbed = scrubCatalogForCountry(cachedCatalog, CACHE_COUNTRY);
    if (scrubbed !== cachedCatalog) {
      after(() => writeLibraryCatalog(user.id, CACHE_COUNTRY, scrubbed));
    }
    return (
      <LibraryContent
        sections={scrubbed.sections}
        userProviderIds={userProviderIds}
        statusMap={statusMap}
        prefs={prefs}
        pendingTitleIds={scrubbed.pendingTitleIds}
        userScope={user.id}
        country={CACHE_COUNTRY}
      />
    );
  }

  const { data: lists } = await supabase
    .from("lists")
    .select("id, name")
    .eq("user_id", user.id)
    .order("position", { ascending: true });

  if (!lists?.length) {
    after(() =>
      writeLibraryCatalog(user.id, CACHE_COUNTRY, {
        sections: [],
        pendingTitleIds: [],
      }),
    );
    return (
      <LibraryContent
        sections={[]}
        userProviderIds={userProviderIds}
        statusMap={statusMap}
        prefs={prefs}
        pendingTitleIds={[]}
        userScope={user.id}
        country={CACHE_COUNTRY}
      />
    );
  }

  const listIds = lists.map((l) => l.id);

  const { data: items } = await supabase
    .from("list_items")
    .select("list_id, title_id, title_type, position")
    .in("list_id", listIds)
    .order("position", { ascending: true });

  const byList: Record<
    string,
    { title_id: string; title_type: string; position: number }[]
  > = {};
  for (const item of items ?? []) {
    if (!byList[item.list_id]) byList[item.list_id] = [];
    byList[item.list_id].push({
      title_id: item.title_id,
      title_type: item.title_type,
      position: item.position,
    });
  }
  for (const listId of Object.keys(byList)) {
    byList[listId].sort((a, b) => a.position - b.position);
  }

  const allUniqueIds = [...new Set((items ?? []).map((i) => i.title_id))];
  const typeById = new Map<string, string>();
  for (const item of items ?? []) {
    if (!typeById.has(item.title_id)) {
      typeById.set(item.title_id, item.title_type);
    }
  }

  const pendingTitleIds = allUniqueIds;

  const sections: ListSection[] = lists.map((list) => {
    const titles = (byList[list.id] ?? []).map((row) => {
      return stubTitle(
        row.title_id,
        typeById.get(row.title_id) ?? row.title_type,
      );
    });
    return { id: list.id, name: list.name, titles };
  });
  after(() =>
    writeLibraryCatalog(user.id, CACHE_COUNTRY, {
      sections,
      pendingTitleIds,
    }),
  );

  return (
    <LibraryContent
      sections={sections}
      userProviderIds={userProviderIds}
      statusMap={statusMap}
      prefs={prefs}
      pendingTitleIds={pendingTitleIds}
      userScope={user.id}
      country={CACHE_COUNTRY}
    />
  );
}

export default async function LibraryPage({
  searchParams,
}: {
  searchParams?: Promise<{ device?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const login = localizedPath("/login", await getLocale());
    redirect(withTvDeviceQuery(login, params.device));
  }

  return (
    <main className="container mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Suspense
        fallback={
          <div className="space-y-10">
            <div className="h-8 w-56 animate-pulse rounded-lg bg-white/5" />
            {[1, 2].map((s) => (
              <div key={s} className="space-y-4">
                <div className="h-6 w-40 animate-pulse rounded bg-white/5" />
                <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-72 animate-pulse rounded-xl bg-white/5"
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        }
      >
        <LibraryData userId={user.id} />
      </Suspense>
    </main>
  );
}
