import { Redis } from "@upstash/redis";
import { env, isConfiguredPair } from "@/env";
import type { ListSection, StatusMap } from "@/types/library";
import type { UnifiedTitle } from "@/types/streaming";

const LIBRARY_CACHE_TTL_SECONDS = 15 * 60;
const REDIS_TIMEOUT_MS = 750;

export type LibraryCatalogCache = {
  sections: ListSection[];
  pendingTitleIds: string[];
};

export type LibraryStatusCache = {
  statusMap: StatusMap;
};

let redisClient: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redisClient !== undefined) return redisClient;
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;
  if (!isConfiguredPair(url, token)) {
    redisClient = null;
    return null;
  }
  redisClient = new Redis({ url, token });
  return redisClient;
}

function catalogKey(userId: string, country: string): string {
  // v2: invalidate catalogs that may have cached Watchmode US links for MX/SA regions
  return `watchily:library:v2:catalog:${userId}:${country}`;
}

function statusKey(userId: string): string {
  return `watchily:library:v1:statuses:${userId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isUnifiedTitle(value: unknown): value is UnifiedTitle {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    (value.type === "movie" || value.type === "series")
  );
}

function isCatalog(value: unknown): value is LibraryCatalogCache {
  if (!isRecord(value)) return false;
  return (
    Array.isArray(value.pendingTitleIds) &&
    value.pendingTitleIds.every((id) => typeof id === "string") &&
    Array.isArray(value.sections) &&
    value.sections.every(
      (section) =>
        isRecord(section) &&
        typeof section.id === "string" &&
        typeof section.name === "string" &&
        Array.isArray(section.titles) &&
        section.titles.every(isUnifiedTitle),
    )
  );
}

function isStatusCache(value: unknown): value is LibraryStatusCache {
  if (!isRecord(value) || !isRecord(value.statusMap)) return false;
  return Object.values(value.statusMap).every(
    (status) => status === "watching" || status === "finished",
  );
}

async function withRedisTimeout<T>(operation: Promise<T>): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error("Library Redis request timed out")),
          REDIS_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

export async function readLibraryCatalog(
  userId: string,
  country: string,
): Promise<LibraryCatalogCache | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const cached = await withRedisTimeout(
      redis.get<unknown>(catalogKey(userId, country)),
    );
    return isCatalog(cached) ? cached : null;
  } catch {
    return null;
  }
}

export async function writeLibraryCatalog(
  userId: string,
  country: string,
  value: LibraryCatalogCache,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await withRedisTimeout(
      redis.setex(
        catalogKey(userId, country),
        LIBRARY_CACHE_TTL_SECONDS,
        value,
      ),
    );
  } catch {
    // Redis is an optimization; Supabase remains the source of truth.
  }
}

export async function readLibraryStatuses(
  userId: string,
): Promise<LibraryStatusCache | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const cached = await withRedisTimeout(
      redis.get<unknown>(statusKey(userId)),
    );
    return isStatusCache(cached) ? cached : null;
  } catch {
    return null;
  }
}

export async function writeLibraryStatuses(
  userId: string,
  value: LibraryStatusCache,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await withRedisTimeout(
      redis.setex(statusKey(userId), LIBRARY_CACHE_TTL_SECONDS, value),
    );
  } catch {
    // Redis is an optimization; Supabase remains the source of truth.
  }
}

export async function invalidateLibraryCatalog(
  userId: string,
  country = "MX",
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await withRedisTimeout(redis.del(catalogKey(userId, country)));
  } catch {
    // The TTL bounds stale data if invalidation is temporarily unavailable.
  }
}

export async function invalidateLibraryStatuses(userId: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await withRedisTimeout(redis.del(statusKey(userId)));
  } catch {
    // The TTL bounds stale data if invalidation is temporarily unavailable.
  }
}
