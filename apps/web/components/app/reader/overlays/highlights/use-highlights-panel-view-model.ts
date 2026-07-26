"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { ReaderTocNode } from "@/lib/api-types";
import type { HighlightColor } from "@/features/offline/buckets/highlights";
import { collectTocChapterEntries } from "@/features/reader/toc";
import { useHighlightsContext } from "./highlights-context";

export type HighlightsPanelRow = {
  id: string;
  text: string;
  color: HighlightColor;
  chapterLabel: string;
};

export type HighlightsPanelViewModel = {
  activeFilterId: HighlightColor | "all";
  setActiveFilterId: (next: HighlightColor | "all") => void;
  searchQuery: string;
  setSearchQuery: (next: string) => void;
  total: number;
  counts: Record<HighlightColor, number>;
  visibleHighlights: HighlightsPanelRow[];
  deleteHighlight: (id: string) => void;
};

// Derives everything the highlights panel needs: counts per color, the
// search/filter-applied list grouped by color, and the chapter-label lookup.
// Owns the panel's local UI state (search, active filter). Kept in a hook so
// the overlay component stays focused on layout and we can grow the panel
// (e.g. add sorting) without bloating it.
export function useHighlightsPanelViewModel(
  toc: ReaderTocNode[],
): HighlightsPanelViewModel {
  const t = useTranslations("reader.highlights");
  const { highlights, deleteHighlight } = useHighlightsContext();
  const [activeFilterId, setActiveFilterId] = useState<HighlightColor | "all">(
    "all",
  );
  const [searchQuery, setSearchQuery] = useState("");

  // The reader payload only ships a 3-chapter window of full chapter data, so
  // we read labels and order from the TOC, which covers the whole book.
  const { chapterLabelById, chapterIndexById } = useMemo(() => {
    const entries = collectTocChapterEntries(toc);
    const labels = new Map<string, string>();
    const indices = new Map<string, number>();
    let fallbackIndex = 0;
    for (const [chapterId, entry] of entries) {
      labels.set(chapterId, entry.label);
      indices.set(
        chapterId,
        entry.spineIndex ?? Number.MAX_SAFE_INTEGER - fallbackIndex,
      );
      fallbackIndex += 1;
    }
    return { chapterLabelById: labels, chapterIndexById: indices };
  }, [toc]);

  const counts = useMemo(() => {
    const result: Record<HighlightColor, number> = {
      apricot: 0,
      mimosa: 0,
      jade: 0,
      sky: 0,
      lavender: 0,
      rose: 0,
      mauve: 0,
    };
    for (const highlight of highlights) {
      result[highlight.color] += 1;
    }
    return result;
  }, [highlights]);

  const visibleHighlights = useMemo<HighlightsPanelRow[]>(() => {
    const trimmedQuery = searchQuery.trim().toLowerCase();
    return highlights
      .filter((highlight) =>
        activeFilterId === "all" ? true : highlight.color === activeFilterId,
      )
      .filter((highlight) =>
        trimmedQuery
          ? highlight.excerpt.toLowerCase().includes(trimmedQuery)
          : true,
      )
      // Group by chapter, latest chapter in the book first. Highlights with
      // no/unknown chapter sink to the bottom. Within a chapter, newest first.
      .sort((a, b) => {
        const aIndex = chapterIndexById.get(a.locator?.chapterId ?? "") ?? -1;
        const bIndex = chapterIndexById.get(b.locator?.chapterId ?? "") ?? -1;
        if (aIndex !== bIndex) {
          if (aIndex === -1) return 1;
          if (bIndex === -1) return -1;
          return bIndex - aIndex;
        }
        return b.createdAt.localeCompare(a.createdAt);
      })
      .map((highlight) => ({
        id: highlight.id,
        text: highlight.excerpt,
        color: highlight.color,
        chapterLabel:
          chapterLabelById.get(highlight.locator?.chapterId ?? "") ??
          t("unknownChapter"),
      }));
  }, [
    activeFilterId,
    chapterIndexById,
    chapterLabelById,
    highlights,
    searchQuery,
    t,
  ]);

  return {
    activeFilterId,
    setActiveFilterId,
    searchQuery,
    setSearchQuery,
    total: highlights.length,
    counts,
    visibleHighlights,
    deleteHighlight,
  };
}
