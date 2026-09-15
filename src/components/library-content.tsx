"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { useMutation } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  MoreHorizontal,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { TitleTile } from "@/components/title-tile";
import { ProviderFilterBar } from "@/components/provider-filter-bar";
import { useProviderFilter } from "@/hooks/use-provider-filter";
import { filterTitlesByUserProviders } from "@/lib/streaming/providers";
import { isLibraryTitleHydrated } from "@/lib/streaming/unified";
import type {
  LibraryPrefs,
  ListSection,
  StatusFilter,
  StatusMap,
  TitleSortMode,
  TypeFilter,
  WatchStatus,
} from "@/types/library";
import type { UnifiedTitle } from "@/types/streaming";
import { cn } from "@/lib/utils";
import { captureProductEvent } from "@/lib/analytics";
import {
  getMutationErrorMessage,
  requireSuccessfulResponse,
} from "@/lib/mutation-feedback";
import { useAuthScope } from "@/components/app-providers";
import { queryKeys, type LibraryEnrichmentResponse } from "@/lib/query";
import { libraryParsers } from "@/lib/url-state";
import { useBatchedInteractionState } from "@/hooks/use-batched-interaction-state";
import { useTvMode } from "@/components/tv-mode-context";

const COLLAPSED_KEY = "watchily.library.collapsed";
const ENRICH_BATCH = 8;

interface Props {
  sections: ListSection[];
  userProviderIds: string[];
  statusMap: StatusMap;
  prefs: LibraryPrefs;
  pendingTitleIds: string[];
  userScope: string;
  country: string;
}

type SharedInteractionProps = {
  memberships: Record<string, string[]>;
  membershipKnown: (titleId: string) => boolean;
  shared: boolean;
  loading: boolean;
};

function sortTitlesByName<T extends { name: string }>(
  titles: T[],
  order: "asc" | "desc",
): T[] {
  return [...titles].sort((a, b) => {
    const cmp = a.name.localeCompare(b.name, undefined, {
      sensitivity: "base",
    });
    return order === "asc" ? cmp : -cmp;
  });
}

function loadCollapsed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(COLLAPSED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(parsed);
  } catch {
    return new Set();
  }
}

function saveCollapsed(ids: Set<string>) {
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...ids]));
  } catch {
    // ignore
  }
}

function titleSortableId(listId: string, titleId: string) {
  return `title:${listId}:${titleId}`;
}

function parseTitleSortableId(
  id: string,
): { listId: string; titleId: string } | null {
  if (!id.startsWith("title:")) return null;
  const rest = id.slice("title:".length);
  const idx = rest.indexOf(":");
  if (idx < 0) return null;
  return { listId: rest.slice(0, idx), titleId: rest.slice(idx + 1) };
}

function SortableListSection({
  section,
  isCollapsed,
  canReorderLists,
  canReorderTitles,
  menuOpenId,
  setMenuOpenId,
  toggleCollapsed,
  deleteList,
  setRenameSection,
  setRenameName,
  statusMap,
  onWatchStatusChange,
  onListsChange,
  onTitlesDragEnd,
  interaction,
}: {
  section: ListSection;
  isCollapsed: boolean;
  canReorderLists: boolean;
  canReorderTitles: boolean;
  menuOpenId: string | null;
  setMenuOpenId: (
    id: string | null | ((prev: string | null) => string | null),
  ) => void;
  toggleCollapsed: (id: string) => void;
  deleteList: (listId: string, listName: string) => void;
  setRenameSection: (s: ListSection | null) => void;
  setRenameName: (n: string) => void;
  statusMap: StatusMap;
  onWatchStatusChange: (titleId: string, status: WatchStatus | null) => void;
  onListsChange: () => void;
  onTitlesDragEnd: (listId: string, event: DragEndEvent) => void;
  interaction: SharedInteractionProps;
}) {
  const t = useTranslations("library");
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id, disabled: !canReorderLists });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
  };

  const titleIds = section.titles.map((t) => titleSortableId(section.id, t.id));

  return (
    <section
      ref={setNodeRef}
      style={style}
      className="rounded-xl border border-white/8 bg-card/20 [content-visibility:auto] [contain-intrinsic-size:0_28rem]"
    >
      <div className="flex items-center gap-2 px-4 py-3">
        {canReorderLists ? (
          <button
            type="button"
            className="flex shrink-0 touch-none items-center justify-center rounded-md p-1 text-muted-foreground hover:bg-white/6 hover:text-foreground"
            aria-label="Drag to reorder list"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-5 w-5" />
          </button>
        ) : null}

        <button
          type="button"
          className="flex shrink-0 items-center justify-center rounded-md p-1 text-muted-foreground hover:bg-white/6 hover:text-foreground"
          onClick={() => toggleCollapsed(section.id)}
          aria-expanded={!isCollapsed}
          aria-label={isCollapsed ? "Expand section" : "Collapse section"}
        >
          {isCollapsed ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <ChevronDown className="h-5 w-5" />
          )}
        </button>

        <h2 className="min-w-0 flex-1 truncate text-lg font-semibold">
          {section.name}
        </h2>

        <span className="shrink-0 rounded-full border border-white/10 bg-white/6 px-2 py-0.5 text-xs font-bold text-foreground/50">
          {section.titles.length}{" "}
          {section.titles.length === 1 ? "title" : "titles"}
        </span>

        <div className="relative shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-expanded={menuOpenId === section.id}
            onClick={() =>
              setMenuOpenId((id) => (id === section.id ? null : section.id))
            }
          >
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">List actions</span>
          </Button>
          {menuOpenId === section.id && (
            <>
              <button
                type="button"
                className="fixed inset-0 z-40 cursor-default"
                aria-label="Close menu"
                onClick={() => setMenuOpenId(null)}
              />
              <div className="absolute right-0 top-full z-50 mt-1 min-w-[10rem] rounded-lg border border-white/10 bg-popover py-1 shadow-lg">
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-white/6"
                  onClick={() => {
                    setMenuOpenId(null);
                    setRenameSection(section);
                    setRenameName(section.name);
                  }}
                >
                  Rename
                </button>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm text-destructive hover:bg-white/6"
                  onClick={() => {
                    setMenuOpenId(null);
                    void deleteList(section.id, section.name);
                  }}
                >
                  Delete
                </button>
                <Link
                  href={`/lists/${section.id}`}
                  className="block px-3 py-2 text-sm hover:bg-white/6"
                  onClick={() => setMenuOpenId(null)}
                >
                  View list
                </Link>
              </div>
            </>
          )}
        </div>
      </div>

      {!isCollapsed && (
        <div className="border-t border-white/6 px-4 pb-4 pt-2">
          {section.titles.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("noMatch")}
            </p>
          ) : canReorderTitles ? (
            <SortableTitlesGrid
              listId={section.id}
              titles={section.titles}
              titleIds={titleIds}
              statusMap={statusMap}
              onWatchStatusChange={onWatchStatusChange}
              onListsChange={onListsChange}
              onTitlesDragEnd={onTitlesDragEnd}
              interaction={interaction}
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
              {section.titles.map((title) => (
                <TitleTile
                  key={title.id}
                  title={title}
                  watchStatus={statusMap[title.id] ?? null}
                  showWatchStatus
                  onWatchStatusChange={onWatchStatusChange}
                  onListsChange={onListsChange}
                  listIds={interaction.memberships[title.id] ?? []}
                  membershipKnown={interaction.membershipKnown(title.id)}
                  interactionStateShared={interaction.shared}
                  interactionLoading={interaction.loading}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function SortableTitlesGrid({
  listId,
  titles,
  titleIds,
  statusMap,
  onWatchStatusChange,
  onListsChange,
  onTitlesDragEnd,
  interaction,
}: {
  listId: string;
  titles: UnifiedTitle[];
  titleIds: string[];
  statusMap: StatusMap;
  onWatchStatusChange: (titleId: string, status: WatchStatus | null) => void;
  onListsChange: () => void;
  onTitlesDragEnd: (listId: string, event: DragEndEvent) => void;
  interaction: SharedInteractionProps;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 150, tolerance: 6 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  return (
    <DndContext
      id={`titles-${listId}`}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={(event) => onTitlesDragEnd(listId, event)}
    >
      <SortableContext items={titleIds} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
          {titles.map((title) => (
            <SortableTitleTile
              key={title.id}
              listId={listId}
              title={title}
              watchStatus={statusMap[title.id] ?? null}
              onWatchStatusChange={onWatchStatusChange}
              onListsChange={onListsChange}
              interaction={interaction}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableTitleTile({
  listId,
  title,
  watchStatus,
  onWatchStatusChange,
  onListsChange,
  interaction,
}: {
  listId: string;
  title: UnifiedTitle;
  watchStatus?: WatchStatus;
  onWatchStatusChange: (titleId: string, status: WatchStatus | null) => void;
  onListsChange: () => void;
  interaction: SharedInteractionProps;
}) {
  const id = titleSortableId(listId, title.id);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative">
      <button
        type="button"
        className="absolute left-2 top-9 z-20 flex touch-none items-center justify-center rounded-md bg-black/70 p-1 text-white/90 hover:bg-black/85"
        aria-label="Drag to reorder title"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <TitleTile
        title={title}
        watchStatus={watchStatus}
        showWatchStatus
        onWatchStatusChange={onWatchStatusChange}
        onListsChange={onListsChange}
        listIds={interaction.memberships[title.id] ?? []}
        membershipKnown={interaction.membershipKnown(title.id)}
        interactionStateShared={interaction.shared}
        interactionLoading={interaction.loading}
      />
    </div>
  );
}

export function LibraryContent({
  sections: initialSections,
  userProviderIds,
  statusMap: initialStatusMap,
  prefs: initialPrefs,
  pendingTitleIds: initialPendingIds,
  userScope,
  country,
}: Props) {
  const t = useTranslations("library");
  const { isTv } = useTvMode();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [urlState, setUrlState] = useQueryStates(libraryParsers, {
    history: "push",
    shallow: true,
  });
  const authScope = useAuthScope();
  const effectiveScope = authScope === undefined ? userScope : authScope;
  const [sections, setSections] = useState(initialSections);
  const [statusMap, setStatusMap] = useState<StatusMap>(initialStatusMap);
  const query = urlState.query;
  const titleSort = searchParams.has("sort")
    ? urlState.sort
    : initialPrefs.titleSort;
  const statusFilter = searchParams.has("status")
    ? urlState.status
    : initialPrefs.statusFilter;
  const typeFilter = urlState.type;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [pendingIds, setPendingIds] = useState(initialPendingIds);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [collapsedReady, setCollapsedReady] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [creating, setCreating] = useState(false);
  const [renameSection, setRenameSection] = useState<ListSection | null>(null);
  const [renameName, setRenameName] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const interactionTitleIds = useMemo(
    () => [
      ...new Set(
        sections.flatMap((section) => section.titles.map((title) => title.id)),
      ),
    ],
    [sections],
  );
  const libraryMemberships = useMemo(() => {
    const memberships: Record<string, string[]> = {};
    for (const section of sections) {
      for (const title of section.titles) {
        const listIds = memberships[title.id] ?? [];
        if (!listIds.includes(section.id)) listIds.push(section.id);
        memberships[title.id] = listIds;
      }
    }
    return memberships;
  }, [sections]);
  const interactionState = useBatchedInteractionState({
    titleIds: interactionTitleIds,
    userId: effectiveScope,
    initialStatuses: initialStatusMap,
    initialMemberships: libraryMemberships,
    initialStatusIds: interactionTitleIds,
    initialMembershipIds: interactionTitleIds,
  });
  const sharedInteraction: SharedInteractionProps = {
    memberships: interactionState.memberships,
    membershipKnown: interactionState.membershipKnown,
    shared: interactionState.isShared,
    loading: interactionState.isLoading,
  };

  const enrichMutation = useMutation({
    mutationKey: queryKeys.libraryEnrichment(country, effectiveScope ?? null),
    mutationFn: async (ids: string[]): Promise<LibraryEnrichmentResponse> => {
      const response = await fetch("/api/library/titles/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, country }),
      });
      if (!response.ok) throw new Error("Could not enrich library titles");
      return (await response.json()) as LibraryEnrichmentResponse;
    },
  });
  const enrichTitles = enrichMutation.mutateAsync;

  const { activeIds, activeCount, totalCount, toggle, setAll } =
    useProviderFilter(userProviderIds);

  const listSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 150, tolerance: 6 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  useEffect(() => {
    setCollapsed(loadCollapsed());
    setCollapsedReady(true);
  }, []);

  useEffect(() => {
    setSections(initialSections);
  }, [initialSections]);

  useEffect(() => {
    setStatusMap(initialStatusMap);
  }, [initialStatusMap]);

  useEffect(() => {
    setPendingIds(initialPendingIds);
  }, [initialPendingIds]);

  useEffect(() => {
    const stubIds = initialSections.flatMap((section) =>
      section.titles.filter((t) => !isLibraryTitleHydrated(t)).map((t) => t.id),
    );
    const queue = [...new Set([...initialPendingIds, ...stubIds])];
    if (queue.length === 0) return;

    let cancelled = false;

    const run = async () => {
      let nextIndex = 0;
      const worker = async () => {
        while (!cancelled) {
          const batch = queue.slice(nextIndex, nextIndex + ENRICH_BATCH);
          nextIndex += ENRICH_BATCH;
          if (batch.length === 0) return;
          let data: LibraryEnrichmentResponse;
          try {
            data = await enrichTitles(batch);
          } catch (error) {
            console.error("[library/enrich]", error);
            continue;
          }
          if (cancelled) return;
          const titles = data.titles ?? [];
          if (titles.length === 0) continue;
          const map = new Map(titles.map((t) => [t.id, t]));
          setSections((prev) =>
            prev.map((section) => ({
              ...section,
              titles: section.titles.map((t) => map.get(t.id) ?? t),
            })),
          );
          setPendingIds((prev) => prev.filter((id) => !map.has(id)));
        }
      };
      await Promise.all([worker(), worker()]);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [enrichTitles, initialPendingIds, initialSections]);

  const persistPrefs = useCallback(
    async (patch: Partial<LibraryPrefs>) => {
      try {
        const res = await fetch("/api/library/prefs", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        await requireSuccessfulResponse(
          res,
          "Could not save library preferences.",
        );
        toast.success("Library preferences saved.");
        return true;
      } catch (error) {
        toast.error(
          getMutationErrorMessage(error, "Could not save library preferences."),
        );
        router.refresh();
        return false;
      }
    },
    [router],
  );

  const changeStatusFilter = async (next: StatusFilter) => {
    void setUrlState({ status: next });
    if (await persistPrefs({ statusFilter: next })) {
      captureProductEvent("library_filter_changed", {
        filter: "status",
        value: next,
      });
    }
  };

  const changeTypeFilter = (next: TypeFilter) => {
    void setUrlState({ type: next });
    captureProductEvent("library_filter_changed", {
      filter: "type",
      value: next,
    });
  };

  const changeTitleSort = async (next: TitleSortMode) => {
    void setUrlState({ sort: next });
    if (await persistPrefs({ titleSort: next })) {
      captureProductEvent("library_filter_changed", {
        filter: "sort",
        value: next,
      });
    }
  };

  const toggleProviderFilter = useCallback(
    (id: string) => {
      toggle(id);
      captureProductEvent("library_filter_changed", {
        filter: "provider",
        value: id,
      });
    },
    [toggle],
  );

  const selectAllProviders = useCallback(() => {
    setAll();
    captureProductEvent("library_filter_changed", {
      filter: "provider",
      value: "all",
    });
  }, [setAll]);

  const handleStatusChange = useCallback(
    (titleId: string, status: WatchStatus | null) => {
      setStatusMap((prev) => {
        const next = { ...prev };
        if (status === null) delete next[titleId];
        else next[titleId] = status;
        return next;
      });
    },
    [],
  );

  const providerFilteredSections = useMemo(() => {
    return sections.map((s) => ({
      ...s,
      titles:
        activeIds.length === 0
          ? []
          : s.titles.flatMap((title) => {
              // Pending enrich: keep visible until sources are known
              if (title.sources === undefined) return [title];
              return filterTitlesByUserProviders([title], activeIds);
            }),
    }));
  }, [sections, activeIds]);

  const processedSections = useMemo(() => {
    const q = query.trim().toLowerCase();

    return providerFilteredSections.map((section) => {
      let titles = section.titles;

      if (statusFilter !== "all") {
        titles = titles.filter((t) => statusMap[t.id] === statusFilter);
      }

      if (typeFilter !== "all") {
        titles = titles.filter((t) => t.type === typeFilter);
      }

      if (q) {
        titles = titles.filter((t) => t.name.toLowerCase().includes(q));
      }

      if (titleSort === "asc" || titleSort === "desc") {
        titles = sortTitlesByName(titles, titleSort);
      }

      return { ...section, titles };
    });
  }, [
    providerFilteredSections,
    statusFilter,
    typeFilter,
    statusMap,
    query,
    titleSort,
  ]);

  const visibleSections = useMemo(() => {
    const q = query.trim();
    if (statusFilter === "all" && typeFilter === "all" && !q) {
      return processedSections;
    }
    return processedSections.filter((s) => s.titles.length > 0);
  }, [processedSections, statusFilter, typeFilter, query]);

  const canReorderLists =
    !isTv &&
    statusFilter === "all" &&
    typeFilter === "all" &&
    !query.trim() &&
    visibleSections.length > 1;
  const canReorderTitles =
    !isTv &&
    titleSort === "custom" &&
    statusFilter === "all" &&
    typeFilter === "all" &&
    !query.trim() &&
    activeCount === totalCount &&
    totalCount > 0;

  const totalUnique = useMemo(() => {
    const seen = new Set<string>();
    for (const s of providerFilteredSections) {
      for (const t of s.titles) seen.add(t.id);
    }
    return seen.size;
  }, [providerFilteredSections]);

  const visibleTitleCount = useMemo(
    () => visibleSections.reduce((acc, s) => acc + s.titles.length, 0),
    [visibleSections],
  );

  const toggleCollapsed = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveCollapsed(next);
      return next;
    });
  };

  const expandAll = () => {
    const next = new Set<string>();
    setCollapsed(next);
    saveCollapsed(next);
  };

  const collapseAll = () => {
    const next = new Set(sections.map((s) => s.id));
    setCollapsed(next);
    saveCollapsed(next);
  };

  const createList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newListName.trim(), is_public: false }),
      });
      await requireSuccessfulResponse(res, "Could not create list.");
      setNewListName("");
      setCreateOpen(false);
      toast.success("List created.");
      router.refresh();
    } catch (error) {
      toast.error(getMutationErrorMessage(error, "Could not create list."));
    } finally {
      setCreating(false);
    }
  };

  const renameList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameSection || !renameName.trim()) return;
    setRenaming(true);
    try {
      const res = await fetch(`/api/lists/${renameSection.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameName.trim() }),
      });
      await requireSuccessfulResponse(res, "Could not rename list.");
      setRenameSection(null);
      toast.success("List renamed.");
      router.refresh();
    } catch (error) {
      toast.error(getMutationErrorMessage(error, "Could not rename list."));
    } finally {
      setRenaming(false);
    }
  };

  const deleteList = async (listId: string, listName: string) => {
    if (
      !confirm(
        `Delete "${listName}"? Titles are not removed — only the list is deleted.`,
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/lists/${listId}`, { method: "DELETE" });
      await requireSuccessfulResponse(res, "Could not delete list.");
      toast.success("List deleted.");
      router.refresh();
    } catch (error) {
      toast.error(getMutationErrorMessage(error, "Could not delete list."));
    }
  };

  const onListsDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sections.findIndex((s) => s.id === active.id);
    const newIndex = sections.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const previous = sections;
    const next = arrayMove(sections, oldIndex, newIndex);
    setSections(next);
    try {
      const res = await fetch("/api/lists/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: next.map((s) => s.id) }),
      });
      await requireSuccessfulResponse(res, "Could not reorder lists.");
      toast.success("Lists reordered.");
    } catch (error) {
      setSections(previous);
      router.refresh();
      toast.error(getMutationErrorMessage(error, "Could not reorder lists."));
    }
  };

  const onTitlesDragEnd = async (listId: string, event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const a = parseTitleSortableId(String(active.id));
    const b = parseTitleSortableId(String(over.id));
    if (!a || !b || a.listId !== listId || b.listId !== listId) return;

    const section = sections.find((s) => s.id === listId);
    if (!section) return;
    const oldIndex = section.titles.findIndex((t) => t.id === a.titleId);
    const newIndex = section.titles.findIndex((t) => t.id === b.titleId);
    if (oldIndex < 0 || newIndex < 0) return;

    const previous = sections;
    const nextTitles = arrayMove(section.titles, oldIndex, newIndex);
    setSections((prev) =>
      prev.map((s) => (s.id === listId ? { ...s, titles: nextTitles } : s)),
    );

    try {
      const res = await fetch(`/api/lists/${listId}/items/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: nextTitles.map((t) => t.id) }),
      });
      await requireSuccessfulResponse(res, "Could not reorder titles.");
      toast.success("Titles reordered.");
    } catch (error) {
      setSections(previous);
      router.refresh();
      toast.error(getMutationErrorMessage(error, "Could not reorder titles."));
    }
  };

  const statusChipClass = (active: boolean) =>
    cn(
      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
      active
        ? "border-primary/50 bg-primary/15 text-primary"
        : "border-white/12 bg-white/5 text-muted-foreground hover:bg-white/8 hover:text-foreground",
    );

  const createListButton = (
    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
      <DialogTrigger asChild>
        <Button
          size="icon"
          className="h-9 w-9 shrink-0"
          aria-label="New list"
          title="New list"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create list</DialogTitle>
        </DialogHeader>
        <form onSubmit={createList} className="space-y-4">
          <div>
            <Label htmlFor="new-list-name">Name</Label>
            <Input
              id="new-list-name"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder="e.g. Watch later"
            />
          </div>
          <Button type="submit" disabled={creating || !newListName.trim()}>
            Create
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );

  const filtersToggle = (
    <Button
      type="button"
      variant={filtersOpen ? "secondary" : "outline"}
      size="icon"
      className="h-9 w-9 shrink-0"
      aria-label="Filters"
      aria-expanded={filtersOpen}
      title="Filters"
      onClick={() => setFiltersOpen((o) => !o)}
    >
      <SlidersHorizontal className="h-4 w-4" />
    </Button>
  );

  const filterDrawer = filtersOpen ? (
    <div className="max-h-[min(55vh,28rem)] space-y-4 overflow-y-auto rounded-xl border border-white/10 bg-card/40 p-4">
      <div className="relative w-full sm:max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t("find")}
          value={query}
          onChange={(e) =>
            void setUrlState(
              { query: e.target.value || null },
              { history: "replace" },
            )
          }
          className="h-9 pl-9 pr-9 text-sm"
        />
        {query ? (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
            onClick={() => void setUrlState({ query: null })}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {isTv ? (
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Sort titles"
          >
            <button
              type="button"
              className={statusChipClass(titleSort === "custom")}
              onClick={() => changeTitleSort("custom")}
            >
              {t("customOrder")}
            </button>
            <button
              type="button"
              className={statusChipClass(titleSort === "asc")}
              onClick={() => changeTitleSort("asc")}
            >
              {t("nameAsc")}
            </button>
            <button
              type="button"
              className={statusChipClass(titleSort === "desc")}
              onClick={() => changeTitleSort("desc")}
            >
              {t("nameDesc")}
            </button>
          </div>
        ) : (
          <Select
            value={titleSort}
            onValueChange={(value) => changeTitleSort(value as TitleSortMode)}
          >
            <SelectTrigger className="w-[11.5rem]" aria-label="Sort titles">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="custom">{t("customOrder")}</SelectItem>
              <SelectItem value="asc">{t("nameAsc")}</SelectItem>
              <SelectItem value="desc">{t("nameDesc")}</SelectItem>
            </SelectContent>
          </Select>
        )}
        <Button variant="outline" size="sm" onClick={expandAll}>
          {t("expandAll")}
        </Button>
        <Button variant="outline" size="sm" onClick={collapseAll}>
          {t("collapseAll")}
        </Button>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("status")}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={statusChipClass(statusFilter === "all")}
            onClick={() => changeStatusFilter("all")}
          >
            {t("all")}
          </button>
          <button
            type="button"
            className={statusChipClass(statusFilter === "watching")}
            onClick={() => changeStatusFilter("watching")}
          >
            {t("watching")}
          </button>
          <button
            type="button"
            className={statusChipClass(statusFilter === "finished")}
            onClick={() => changeStatusFilter("finished")}
          >
            {t("finished")}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Type
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={statusChipClass(typeFilter === "all")}
            onClick={() => changeTypeFilter("all")}
          >
            {t("all")}
          </button>
          <button
            type="button"
            className={statusChipClass(typeFilter === "movie")}
            onClick={() => changeTypeFilter("movie")}
          >
            {t("movies")}
          </button>
          <button
            type="button"
            className={statusChipClass(typeFilter === "series")}
            onClick={() => changeTypeFilter("series")}
          >
            {t("series")}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Platforms
        </p>
        <ProviderFilterBar
          userProviderIds={userProviderIds}
          activeIds={activeIds}
          activeCount={activeCount}
          totalCount={totalCount}
          onToggle={toggleProviderFilter}
          onSelectAll={selectAllProviders}
        />
      </div>
    </div>
  ) : null;

  if (sections.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <div className="flex shrink-0 items-center gap-2">
            {createListButton}
            {filtersToggle}
          </div>
        </div>
        {filterDrawer}
        <div className="rounded-xl border border-white/8 bg-card/30 py-16 text-center">
          <p className="text-muted-foreground">{t("empty")}</p>
        </div>
      </div>
    );
  }

  const showUpdating = enrichMutation.isPending || pendingIds.length > 0;

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold">{t("title")}</h1>
              <span className="rounded-full border border-white/12 bg-white/8 px-2.5 py-0.5 text-sm font-semibold text-foreground/60">
                {totalUnique}
              </span>
              {activeCount < totalCount && totalCount > 0 ? (
                <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                  {t("platformCount", {
                    active: activeCount,
                    total: totalCount,
                  })}
                </span>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {createListButton}
              {filtersToggle}
            </div>
          </div>

          {showUpdating ? (
            <p className="text-xs text-muted-foreground">{t("updating")}</p>
          ) : null}
        </div>

        {filterDrawer}
      </div>

      {query && (
        <p className="text-sm text-muted-foreground">
          {visibleTitleCount === 0
            ? `No results for "${query}"`
            : `${visibleTitleCount} ${visibleTitleCount === 1 ? "result" : "results"} for "${query}"`}
        </p>
      )}

      {activeCount === 0 ? (
        <div className="rounded-xl border border-white/8 bg-card/30 py-16 text-center">
          <p className="text-muted-foreground">
            Enable at least one platform to see titles.
          </p>
        </div>
      ) : (
        <DndContext
          id="library-lists"
          sensors={listSensors}
          collisionDetection={closestCenter}
          onDragEnd={onListsDragEnd}
        >
          <SortableContext
            items={visibleSections.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-6">
              {visibleSections.map((section) => {
                const isCollapsed = collapsedReady && collapsed.has(section.id);
                return (
                  <SortableListSection
                    key={section.id}
                    section={section}
                    isCollapsed={isCollapsed}
                    canReorderLists={canReorderLists}
                    canReorderTitles={canReorderTitles && !isCollapsed}
                    menuOpenId={menuOpenId}
                    setMenuOpenId={setMenuOpenId}
                    toggleCollapsed={toggleCollapsed}
                    deleteList={deleteList}
                    setRenameSection={setRenameSection}
                    setRenameName={setRenameName}
                    statusMap={statusMap}
                    onWatchStatusChange={handleStatusChange}
                    onListsChange={() => router.refresh()}
                    onTitlesDragEnd={onTitlesDragEnd}
                    interaction={sharedInteraction}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <Dialog
        open={renameSection !== null}
        onOpenChange={(open) => !open && setRenameSection(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename list</DialogTitle>
          </DialogHeader>
          <form onSubmit={renameList} className="space-y-4">
            <div>
              <Label htmlFor="rename-list">Name</Label>
              <Input
                id="rename-list"
                value={renameName}
                onChange={(e) => setRenameName(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={renaming || !renameName.trim()}>
              Save
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
