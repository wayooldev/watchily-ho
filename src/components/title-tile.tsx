"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, BookmarkCheck, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { TbBrandDisney, TbBrandHbo, TbBrandNetflix } from "react-icons/tb";
import {
  SiAppletv,
  SiCrunchyroll,
  SiPrimevideo,
  SiParamountplus,
} from "react-icons/si";
import type { UnifiedTitle } from "@/types/streaming";
import type { WatchStatus } from "@/types/library";
import { WatchStatusControls } from "@/components/watch-status-controls";
import { dedupeSubscriptionSourcesByBrand } from "@/lib/streaming/providers";
import { cn } from "@/lib/utils";
import { captureProductEvent } from "@/lib/analytics";
import {
  getMutationErrorMessage,
  requireSuccessfulResponse,
} from "@/lib/mutation-feedback";
import { useAuthScope } from "@/components/app-providers";
import { useTvMode } from "@/components/tv-mode-context";
import { StreamingLink } from "@/components/streaming-link";
import {
  queryKeys,
  type ListResponse,
  type MembershipResponse,
  updateMembershipCaches,
} from "@/lib/query";

const API_BASE = "";

/* ── Platform icon matcher ── */
type IconComponent = React.ComponentType<{
  className?: string;
  style?: React.CSSProperties;
}>;
interface PlatformDef {
  Icon: IconComponent;
  color: string;
  label: string;
}

const PLATFORMS: [RegExp, PlatformDef][] = [
  [/netflix/i, { Icon: TbBrandNetflix, color: "#E50914", label: "Netflix" }],
  [/disney/i, { Icon: TbBrandDisney, color: "#113CCF", label: "Disney+" }],
  [/\b(hbo|max)\b/i, { Icon: TbBrandHbo, color: "#B535F6", label: "HBO Max" }],
  [
    /\b(prime|amazon)\b/i,
    { Icon: SiPrimevideo, color: "#00A8E1", label: "Prime Video" },
  ],
  [/apple/i, { Icon: SiAppletv, color: "#FFFFFF", label: "Apple TV+" }],
  [
    /crunchyroll/i,
    { Icon: SiCrunchyroll, color: "#F47521", label: "Crunchyroll" },
  ],
  [
    /paramount/i,
    { Icon: SiParamountplus, color: "#0064FF", label: "Paramount+" },
  ],
];

function getPlatformDef(name: string): PlatformDef | null {
  for (const [re, def] of PLATFORMS) {
    if (re.test(name)) return def;
  }
  return null;
}

/* ── IMDb logo badge ── */
function ImdbBadge({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5 rounded bg-[#f5c518] px-1 py-0.5 text-[10px] font-bold leading-none text-black sm:gap-1 sm:px-1.5 sm:text-[11px]">
      IMDb {rating.toFixed(1)}
    </span>
  );
}

/* ── Rotten Tomatoes badge ── */
function RTBadge({ rating }: { rating: number }) {
  const fresh = rating >= 60;
  return (
    <span
      className={cn(
        "flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-bold leading-none sm:gap-1 sm:px-1.5 sm:text-[11px]",
        fresh ? "bg-red-600 text-white" : "bg-zinc-600 text-white",
      )}
    >
      {fresh ? "🍅" : "🥦"} {rating}%
    </span>
  );
}

/* ── Lists dialog ── */
function BookmarkDialog({
  title,
  onListsChange,
  listIds,
  membershipKnown = false,
}: {
  title: UnifiedTitle;
  onListsChange?: () => void;
  listIds?: string[];
  membershipKnown?: boolean;
}) {
  const t = useTranslations("lists");
  const queryClient = useQueryClient();
  const authScope = useAuthScope();
  const [open, setOpen] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [creating, setCreating] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [localListIds, setLocalListIds] = useState<string[]>();

  const membershipQuery = useQuery({
    queryKey: queryKeys.membership(title.id, authScope ?? null),
    queryFn: async (): Promise<MembershipResponse> =>
      (
        await fetch(
          `${API_BASE}/api/lists/items?title_id=${encodeURIComponent(title.id)}`,
        )
      ).json(),
    enabled:
      open && !membershipKnown && authScope !== undefined && authScope !== null,
  });
  const listsQuery = useQuery({
    queryKey: queryKeys.lists(authScope ?? null),
    queryFn: async (): Promise<{ lists: ListResponse[] }> =>
      (await fetch(`${API_BASE}/api/lists`)).json(),
    enabled: open && authScope !== undefined && authScope !== null,
  });
  const membershipMutation = useMutation({
    mutationKey: ["list-membership", title.id, authScope],
    mutationFn: async ({
      listId,
      action,
    }: {
      listId: string;
      action: "add" | "remove";
    }) => {
      const response = await fetch(
        `${API_BASE}/api/lists/${listId}/items?title_id=${encodeURIComponent(title.id)}`,
        action === "add"
          ? {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title_id: title.id,
                title_type: title.type,
              }),
            }
          : { method: "DELETE" },
      );
      await requireSuccessfulResponse(
        response,
        action === "add" ? t("addListError") : t("removeListError"),
      );
      return { listId, action };
    },
    onSuccess: ({ listId, action }) => {
      const current =
        localListIds ??
        (membershipKnown
          ? (listIds ?? [])
          : (membershipQuery.data?.listIdsByTitle[title.id] ?? []));
      setLocalListIds(
        action === "add"
          ? [...new Set([...current, listId])]
          : current.filter((id) => id !== listId),
      );
      updateMembershipCaches(
        queryClient,
        authScope ?? null,
        title.id,
        listId,
        action,
      );
      void queryClient.invalidateQueries({ queryKey: ["lists"] });
      setDirty(true);
    },
  });
  const createListMutation = useMutation({
    mutationKey: ["create-list", authScope],
    mutationFn: async () => {
      const response = await fetch(`${API_BASE}/api/lists`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newListName.trim(), is_public: false }),
      });
      await requireSuccessfulResponse(response, t("createListError"));
      return (await response.json()) as ListResponse;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.lists(authScope ?? null),
      });
    },
  });

  const handleOpenChange = (next: boolean) => {
    if (!next && dirty) {
      setDirty(false);
      onListsChange?.();
    }
    setOpen(next);
  };

  const addToList = async (listId: string) => {
    try {
      await membershipMutation.mutateAsync({ listId, action: "add" });
      captureProductEvent("list_membership_changed", {
        action: "add",
        titleType: title.type,
      });
      toast.success("Añadido a la lista.");
      return true;
    } catch (error) {
      toast.error(getMutationErrorMessage(error, t("addListError")));
      return false;
    }
  };

  const removeFromList = async (listId: string) => {
    try {
      await membershipMutation.mutateAsync({ listId, action: "remove" });
      captureProductEvent("list_membership_changed", {
        action: "remove",
        titleType: title.type,
      });
      toast.success("Quitado de la lista.");
      return true;
    } catch (error) {
      toast.error(getMutationErrorMessage(error, t("removeListError")));
      return false;
    }
  };

  const createListAndAdd = async () => {
    if (!newListName.trim()) return;
    try {
      setCreating(true);
      const created = await createListMutation.mutateAsync();
      if (created.id && created.name && (await addToList(created.id))) {
        setNewListName("");
      }
    } catch (error) {
      toast.error(getMutationErrorMessage(error, t("createListError")));
    } finally {
      setCreating(false);
    }
  };

  const lists = listsQuery.data?.lists ?? [];
  const listIdsForTitle =
    localListIds ??
    (membershipKnown
      ? (listIds ?? [])
      : (membershipQuery.data?.listIdsByTitle[title.id] ?? []));
  const inAnyList = listIdsForTitle.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="secondary"
          size="icon"
          className="h-8 w-8 shrink-0 rounded-full bg-black/60 backdrop-blur-sm transition-all duration-150 hover:scale-110 hover:bg-black/85 hover:ring-2 hover:ring-primary/60"
          title={t("addToList")}
        >
          {inAnyList ? (
            <BookmarkCheck className="h-4 w-4 text-primary" />
          ) : (
            <Bookmark className="h-4 w-4" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("addToList")}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground truncate">{title.name}</p>

        {lists.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">{t("noLists")}</p>
        ) : (
          <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
            {lists.map((list) => {
              const inList = listIdsForTitle.includes(list.id);
              return (
                <div
                  key={list.id}
                  className="flex items-center justify-between rounded-lg border border-white/10 bg-card/60 px-3 py-2"
                >
                  <span className="text-sm">{list.name}</span>
                  <Button
                    variant={inList ? "destructive" : "default"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() =>
                      inList ? removeFromList(list.id) : addToList(list.id)
                    }
                  >
                    {inList ? t("remove") : t("add")}
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Input
            placeholder={t("newListPlaceholder")}
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createListAndAdd()}
            className="h-9 text-sm"
          />
          <Button
            onClick={createListAndAdd}
            disabled={!newListName.trim() || creating}
            size="sm"
            className="h-9 shrink-0"
          >
            {t("createAndAdd")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Main tile ── */
export function TitleTile({
  title,
  showWatchStatus = false,
  watchStatus,
  onWatchStatusChange,
  onListsChange,
  listIds,
  membershipKnown = false,
  interactionStateShared = false,
  interactionLoading = false,
}: {
  title: UnifiedTitle;
  showWatchStatus?: boolean;
  watchStatus?: WatchStatus | null;
  onWatchStatusChange?: (titleId: string, status: WatchStatus | null) => void;
  /** Called after list membership changes when the bookmark dialog closes. */
  onListsChange?: () => void;
  listIds?: string[];
  membershipKnown?: boolean;
  interactionStateShared?: boolean;
  interactionLoading?: boolean;
}) {
  const t = useTranslations("common");
  const { reduceMotion } = useTvMode();
  const pending = title.sources === undefined && !title.poster && !title.name;
  const posterUrl = title.poster?.startsWith("http") ? title.poster : undefined;
  const subSources = title.sources
    ? dedupeSubscriptionSourcesByBrand(title.sources)
    : [];
  const firstSource = title.sources?.find((s) => s.url);
  const hasInfo =
    title.imdbRating != null ||
    title.rottenTomatoesRating != null ||
    subSources.length > 0;

  // Use first platform's color for the hover glow
  const firstPlatformColor =
    subSources.length > 0
      ? (getPlatformDef(subSources[0].providerName)?.color ?? "#6366f1")
      : "#6366f1";

  const tileClassName =
    "group relative flex flex-col overflow-hidden rounded-xl border border-white/10 bg-card";

  return (
    <motion.div
      className={tileClassName}
      initial={reduceMotion ? false : { opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : { duration: 0.3, ease: [0.25, 0.4, 0.25, 1] }
      }
      whileHover={
        reduceMotion
          ? undefined
          : {
              scale: 1.03,
              borderColor: `${firstPlatformColor}90`,
              boxShadow: `0 0 0 1px ${firstPlatformColor}50, 0 10px 40px ${firstPlatformColor}35`,
            }
      }
    >
      {/* Poster */}
      <div className="relative aspect-2/3 overflow-hidden bg-muted">
        {pending ? (
          <div
            className="absolute inset-0 animate-pulse bg-white/8"
            aria-hidden
          />
        ) : (
          <Link href={`/title/${title.id}`} className="absolute inset-0 block">
            {posterUrl ? (
              <Image
                src={posterUrl}
                alt={title.name}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                unoptimized
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-muted-foreground">
                {(title.name || "?").slice(0, 2)}
              </div>
            )}
          </Link>
        )}

        {/* Type badge — top left */}
        <span
          className={`pointer-events-none absolute left-2 top-2 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
            title.type === "series"
              ? "bg-primary text-primary-foreground"
              : "bg-black/60 text-white/90 backdrop-blur-sm"
          }`}
        >
          {title.type === "series" ? t("series") : t("movie")}
        </span>

        {/* Watch status + bookmark — top right */}
        <div className="absolute right-2 top-2 z-10 flex flex-col items-end gap-1.5">
          {!pending && showWatchStatus && (
            <WatchStatusControls
              titleId={title.id}
              status={watchStatus}
              onChange={onWatchStatusChange}
              isKnown={watchStatus !== undefined}
              isLoading={interactionLoading && watchStatus === undefined}
              suppressFallback={interactionStateShared}
              compact
            />
          )}
          {!pending && (
            <BookmarkDialog
              title={title}
              onListsChange={onListsChange}
              listIds={listIds}
              membershipKnown={membershipKnown}
            />
          )}
        </div>

        {/* Year + ratings — bottom overlay (keeps mobile tiles short) */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-end gap-1 bg-linear-to-t from-black/75 via-black/35 to-transparent px-2 pb-2 pt-8">
          {title.year != null && (
            <span className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white/80 backdrop-blur-sm">
              {title.year}
            </span>
          )}
          {title.imdbRating != null && <ImdbBadge rating={title.imdbRating} />}
          {title.rottenTomatoesRating != null && (
            <RTBadge rating={title.rottenTomatoesRating} />
          )}
        </div>
      </div>

      {/* Info section — compact on mobile so ~2 rows fit in the viewport */}
      <div className="flex flex-col gap-1.5 p-2 sm:gap-2 sm:p-2.5">
        {/* Title */}
        {pending ? (
          <div className="h-4 w-3/4 animate-pulse rounded bg-white/10" />
        ) : (
          <Link href={`/title/${title.id}`} className="min-w-0">
            <p className="truncate text-xs font-semibold leading-tight text-foreground sm:text-sm">
              {title.name}
            </p>
          </Link>
        )}

        {/* Platform icons — each links to that platform's page for this title */}
        {subSources.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
            {subSources.slice(0, 5).map((source, i) => {
              const def = getPlatformDef(source.providerName);
              const Wrapper = source.url
                ? ({ children }: { children: React.ReactNode }) => (
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      onClickCapture={() =>
                        captureProductEvent("streaming_link_clicked", {
                          provider: source.providerName,
                          offerType: source.type,
                        })
                      }
                      title={def?.label ?? source.providerName}
                    >
                      {children}
                    </a>
                  )
                : ({ children }: { children: React.ReactNode }) => (
                    <span title={def?.label ?? source.providerName}>
                      {children}
                    </span>
                  );

              if (!def)
                return (
                  <Wrapper key={i}>
                    <span className="rounded-md border border-white/10 bg-white/8 px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:border-white/25 hover:text-foreground sm:px-2">
                      {source.providerName}
                    </span>
                  </Wrapper>
                );
              return (
                <Wrapper key={i}>
                  <div
                    className="flex h-6 w-6 items-center justify-center rounded-md border transition-all duration-150 hover:scale-115 hover:brightness-125 sm:h-8 sm:w-8 sm:rounded-lg"
                    style={{
                      backgroundColor: `${def.color}22`,
                      borderColor: `${def.color}55`,
                    }}
                  >
                    <def.Icon
                      className="h-3.5 w-3.5 sm:h-5 sm:w-5"
                      style={{ color: def.color }}
                    />
                  </div>
                </Wrapper>
              );
            })}
          </div>
        )}

        {/* Ver ahora — desktop/tablet only; on mobile the tile link + platform icons cover it */}
        {firstSource?.url &&
          (() => {
            const def = getPlatformDef(firstSource.providerName);
            // Apple TV+ brand is white — use dark bg instead
            const isWhite = def?.color === "#FFFFFF";
            const btnColor = isWhite
              ? "#2a2a2e"
              : (def?.color ?? "var(--primary)");
            return (
              <StreamingLink
                source={firstSource}
                className="group/play hidden sm:block"
              >
                <div
                  role="presentation"
                  onClick={(e) => e.stopPropagation()}
                  className="flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 text-xs font-bold text-white transition-all duration-150 ease-out group-hover/play:-translate-y-px group-hover/play:brightness-115 active:scale-95 active:brightness-90"
                  style={{
                    background: `linear-gradient(135deg, ${btnColor}ee 0%, ${btnColor}99 100%)`,
                    borderColor: `${btnColor}55`,
                    boxShadow: `0 2px 10px ${btnColor}45, inset 0 1px 0 rgba(255,255,255,0.12)`,
                  }}
                >
                  <Play className="h-3 w-3 shrink-0 fill-white" />
                  <span>{t("watchNow")}</span>
                  {def && (
                    <def.Icon
                      className="ml-auto h-4 w-4 shrink-0"
                      style={{ color: isWhite ? "#fff" : def.color }}
                    />
                  )}
                </div>
              </StreamingLink>
            );
          })()}

        {/* Fallback: no info, just show genre/type hint */}
        {!hasInfo && !firstSource?.url && (
          <p className="text-[11px] text-muted-foreground">
            {title.type === "series" ? t("series") : t("movie")}
          </p>
        )}
      </div>
    </motion.div>
  );
}
