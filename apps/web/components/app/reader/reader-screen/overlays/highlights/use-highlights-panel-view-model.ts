"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { ReaderChapterPayload } from "@/lib/api-types";
import type { HighlightColor } from "@/lib/highlights-store";
import { HIGHLIGHT_COLOR_ORDER } from "./highlights-data";
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
  chapters: ReaderChapterPayload[],
): HighlightsPanelViewModel {
  const t = useTranslations("reader.highlights");
  const { highlights, deleteHighlight } = useHighlightsContext();
  const [activeFilterId, setActiveFilterId] = useState<HighlightColor | "all">(
    "all",
  );
  const [searchQuery, setSearchQuery] = useState("");

  const chapterLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const chapter of chapters) {
      map.set(chapter.chapterId, chapter.title);
    }
    return map;
  }, [chapters]);

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
      // Group by color so the panel reads as "all jade together, then sky,
      // …" — that's what "aggregated by color" means in the brief.
      .sort((a, b) => {
        if (a.color !== b.color) {
          return (
            HIGHLIGHT_COLOR_ORDER.indexOf(a.color) -
            HIGHLIGHT_COLOR_ORDER.indexOf(b.color)
          );
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
  }, [activeFilterId, chapterLabelById, highlights, searchQuery, t]);

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
