import type {
  UnifiedTitle,
  UnifiedSearchResult,
  StreamingSource,
} from "@/types/streaming";
import { env } from "@/env";
import * as watchmode from "./watchmode";
import * as streamingAvailability from "./streaming-availability";

/** DB + enrich freshness window for availability payloads (quota protection). */
export const AVAILABILITY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * When true (default), countries outside Watchmode plan-enabled set use SA for sources.
 * Set AVAILABILITY_SA_FOR_UNSUPPORTED_REGIONS=0 to rollback to Watchmode-primary (US remap).
 */
export function isSaUnsupportedRegionRoutingEnabled(): boolean {
  const v = env.AVAILABILITY_SA_FOR_UNSUPPORTED_REGIONS.toLowerCase();
  if (v === "0" || v === "false" || v === "off") return false;
  return true;
}

export function countryNeedsSaAvailability(countryCode: string): boolean {
  return (
    isSaUnsupportedRegionRoutingEnabled() &&
    !watchmode.isWatchmodeAvailabilityRegion(countryCode)
  );
}

export function isAvailabilityCacheFresh(
  refreshedAt: string | Date | null | undefined,
  now = Date.now(),
): boolean {
  if (!refreshedAt) return false;
  const ts =
    typeof refreshedAt === "string"
      ? Date.parse(refreshedAt)
      : refreshedAt.getTime();
  if (!Number.isFinite(ts)) return false;
  return now - ts < AVAILABILITY_CACHE_TTL_MS;
}

/**
 * True when a cached UnifiedTitle is safe to serve for `country`.
 * For MX and other non-Watchmode plan regions, Watchmode (or unmarked) sources
 * are US remaps and must not power Watch now — require availabilitySource=sa.
 */
export function isAvailabilityPayloadRegionCorrect(
  title: UnifiedTitle,
  country: string,
): boolean {
  if (!countryNeedsSaAvailability(country)) return true;
  // Stubs awaiting enrich stay visible without sources.
  if (title.sources === undefined && !isLibraryTitleHydrated(title)) {
    return true;
  }
  return title.availabilitySource === "sa";
}

/** Fresh + region-correct row from title_availability_cache. */
export function isCachedAvailabilityUsable(
  title: UnifiedTitle,
  country: string,
  refreshedAt: string | Date | null | undefined,
): boolean {
  return (
    isAvailabilityCacheFresh(refreshedAt) &&
    isLibraryTitleHydrated(title) &&
    isAvailabilityPayloadRegionCorrect(title, country)
  );
}

/** True when library/tile can show real content (not a stub skeleton). */
export function isLibraryTitleHydrated(title: UnifiedTitle): boolean {
  return Boolean(title.name?.trim() || title.poster?.startsWith("http"));
}

function mapWatchmodeDetailsToUnified(
  d: watchmode.WatchmodeTitleDetails,
  sources?: watchmode.WatchmodeSource[],
): UnifiedTitle {
  const src: StreamingSource[] = (sources ?? []).map((s) => ({
    providerId: String(s.source_id),
    providerName: s.name,
    type: (s.type as "sub" | "rent" | "buy" | "free") ?? "sub",
    price: s.price,
    currency: s.currency,
    url: s.web_url,
    quality: s.format as StreamingSource["quality"],
  }));
  return {
    id: String(d.id),
    name: d.title,
    originalName: d.original_title,
    type: d.type === "tv_series" ? "series" : "movie",
    year: d.year,
    poster: d.posterLarge ?? d.posterMedium ?? d.poster,
    backdrop: d.backdrop,
    overview: d.plot_overview,
    imdbRating: d.imdb_rating,
    rottenTomatoesRating: d.rotten_tomatoes,
    userRating: d.user_rating,
    criticScore: d.critic_score,
    runtime: d.runtime_minutes,
    genres: d.genre_names,
    sources: src.length ? src : undefined,
    trailer: d.trailer,
    availabilitySource: "watchmode",
  };
}

function mapWatchmodeResultToUnified(
  r: watchmode.WatchmodeTitleResult,
): UnifiedTitle {
  return {
    id: String(r.id),
    name: r.name,
    type: r.type === "tv_series" ? "series" : "movie",
    year: r.year,
    poster: r.image,
  };
}

function mapWatchmodeAutocompleteToUnified(
  r: watchmode.WatchmodeAutocompleteResult,
): UnifiedTitle {
  return {
    id: String(r.id),
    name: r.name,
    type: r.type === "tv_series" ? "series" : "movie",
    year: r.year,
    poster: r.image_url,
  };
}

function saShowIdFromWatchmode(
  d: watchmode.WatchmodeTitleDetails,
): string | null {
  if (d.imdb_id?.startsWith("tt")) return d.imdb_id;
  if (d.tmdb_id != null) {
    const kind =
      d.tmdb_type === "tv" || d.type === "tv_series" ? "tv" : "movie";
    return `${kind}/${d.tmdb_id}`;
  }
  return null;
}

export async function searchTitles(
  query: string,
  options?: { types?: ("movie" | "series")[]; country?: string },
): Promise<UnifiedSearchResult> {
  const country = (options?.country ?? "us").toLowerCase();

  try {
    const res = await watchmode.watchmodeAutocompleteSearch(query);
    let results = res.results ?? [];

    if (options?.types?.length) {
      const wmTypes = options.types.map((t) =>
        t === "series" ? "tv_series" : "movie",
      );
      results = results.filter((r) => (wmTypes as string[]).includes(r.type));
    }

    const titles = results.map(mapWatchmodeAutocompleteToUnified);
    if (titles.length > 0) {
      return { titles, totalCount: titles.length };
    }
  } catch {
    // fall through
  }

  try {
    const types = options?.types?.map((t) =>
      t === "series" ? "tv_series" : "movie",
    );
    const res = await watchmode.watchmodeSearch(query, types);
    const titles = (res.title_results ?? []).map(mapWatchmodeResultToUnified);
    if (titles.length > 0) {
      return { titles, totalCount: titles.length };
    }
  } catch {
    // fall through
  }

  try {
    const titles = await streamingAvailability.streamingAvailabilitySearch(
      query,
      country,
    );
    return { titles, totalCount: titles.length };
  } catch {
    return { titles: [], totalCount: 0 };
  }
}

/**
 * Metadata from Watchmode; availability from Watchmode only when the country is
 * plan-enabled. Otherwise SA for that country (region correctness — not JustWatch freshness).
 */
export async function getTitleDetails(
  id: string,
  options?: { region?: string; country?: string },
): Promise<UnifiedTitle | null> {
  const country = (options?.region ?? options?.country ?? "US").toUpperCase();
  const useSaForAvailability =
    isSaUnsupportedRegionRoutingEnabled() &&
    !watchmode.isWatchmodeAvailabilityRegion(country);

  try {
    // Metadata always from Watchmode. For unsupported regions, ignore Watchmode
    // sources (they would be remapped US) and load SA sources instead.
    const details = await watchmode.watchmodeTitleDetails(
      id,
      useSaForAvailability ? "US" : country,
    );
    if (!details) {
      // fall through to SA-only below
    } else if (useSaForAvailability) {
      const meta = mapWatchmodeDetailsToUnified(details, []);
      const saId = saShowIdFromWatchmode(details);
      if (saId) {
        const sa = await streamingAvailability.streamingAvailabilityGetTitle(
          saId,
          country.toLowerCase(),
          String(details.id),
        );
        if (sa) {
          return {
            ...meta,
            sources: sa.sources,
            availabilitySource: "sa",
            // Keep Watchmode poster/overview if SA omits them
            poster: meta.poster ?? sa.poster,
            backdrop: meta.backdrop ?? sa.backdrop,
            overview: meta.overview ?? sa.overview,
          };
        }
      }
      return { ...meta, sources: undefined, availabilitySource: "sa" };
    } else {
      return mapWatchmodeDetailsToUnified(details, details.sources);
    }
  } catch {
    // fall through
  }

  const sa = await streamingAvailability.streamingAvailabilityGetTitle(
    id,
    (options?.country ?? options?.region ?? "us").toLowerCase(),
  );
  return sa;
}

export type PopularTitlesPage = {
  titles: UnifiedTitle[];
  page: number;
  totalPages: number;
  hasMore: boolean;
};

export async function getPopularTitlesPaged(options?: {
  type?: "movie" | "series";
  country?: string;
  enrich?: boolean;
  sourceIds?: number[];
  page?: number;
  pageSize?: number;
}): Promise<PopularTitlesPage> {
  const type = options?.type ?? "movie";
  const country = options?.country ?? "US";
  const page = Math.max(1, options?.page ?? 1);
  const pageSize = options?.pageSize ?? 20;

  try {
    const list = await watchmode.watchmodeListTitles(
      type === "movie" ? "movie" : "tv_series",
      { pageSize, page, sourceIds: options?.sourceIds },
    );

    const basic: UnifiedTitle[] = list.titles.map((t) => ({
      id: String(t.id),
      name: t.name,
      type: type === "movie" ? "movie" : "series",
      year: t.year,
      poster: t.image,
    }));

    if (!options?.enrich || basic.length === 0) {
      const titles = basic.filter((t) => t.poster?.startsWith("http"));
      return {
        titles,
        page: list.page,
        totalPages: list.totalPages,
        hasMore: list.page < list.totalPages,
      };
    }

    const ENRICH = Math.min(12, basic.length);
    const toEnrich = basic.slice(0, ENRICH);
    const rest = basic.slice(ENRICH);

    const enriched = await Promise.allSettled(
      toEnrich.map((t) => getTitleDetails(t.id, { country, region: country })),
    );

    const enrichedTitles: UnifiedTitle[] = toEnrich.map((original, i) => {
      const r = enriched[i];
      if (r.status === "fulfilled" && r.value) {
        return { ...r.value, poster: r.value.poster ?? original.poster };
      }
      return original;
    });

    const titles = [...enrichedTitles, ...rest].filter((t) =>
      t.poster?.startsWith("http"),
    );
    return {
      titles,
      page: list.page,
      totalPages: list.totalPages,
      hasMore: list.page < list.totalPages,
    };
  } catch {
    return { titles: [], page, totalPages: 0, hasMore: false };
  }
}

export async function getPopularTitles(options?: {
  type?: "movie" | "series";
  country?: string;
  enrich?: boolean;
  sourceIds?: number[];
  page?: number;
  pageSize?: number;
}): Promise<UnifiedTitle[]> {
  const result = await getPopularTitlesPaged(options);
  return result.titles;
}
