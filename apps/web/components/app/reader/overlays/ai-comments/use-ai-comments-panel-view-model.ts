"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { ReaderTocNode } from "@/lib/api-types";
import { collectTocChapterEntries } from "@/features/reader/toc";
import { useAiCommentsContext } from "./ai-comments-context";
import type {
  AiCommentKind,
  AiCommentPanelRow,
  AiCommentsFilterId,
} from "./ai-comments-data";

export type AiCommentsPanelViewModel = {
  activeFilterId: AiCommentsFilterId;
  setActiveFilterId: (next: AiCommentsFilterId) => void;
  searchQuery: string;
  setSearchQuery: (next: string) => void;
  total: number;
  counts: Record<AiCommentKind, number>;
  visibleComments: AiCommentPanelRow[];
  deleteAiComment: (id: string) => Promise<void>;
};

// Mirrors useHighlightsPanelViewModel: filter + search state, kind counts, and
// chapter-label enrichment from the TOC. Search matches against both the
// source text and the AI body so a user can find a comment by either.
export function useAiCommentsPanelViewModel(
  toc: ReaderTocNode[],
): AiCommentsPanelViewModel {
  const t = useTranslations("reader.aiComments");
  const { comments, deleteAiComment } = useAiCommentsContext();
  const [activeFilterId, setActiveFilterId] =
    useState<AiCommentsFilterId>("all");
  const [searchQuery, setSearchQuery] = useState("");

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

  const counts = useMemo<Record<AiCommentKind, number>>(() => {
    const result: Record<AiCommentKind, number> = {
      EXPLAIN: 0,
      ETYMOLOGY: 0,
      TRANSLATE: 0,
    };
    for (const comment of comments) {
      result[comment.kind] += 1;
    }
    return result;
  }, [comments]);

  const visibleComments = useMemo<AiCommentPanelRow[]>(() => {
    const trimmedQuery = searchQuery.trim().toLowerCase();
    return comments
      .filter((comment) =>
        activeFilterId === "all" ? true : comment.kind === activeFilterId,
      )
      .filter((comment) => {
        if (!trimmedQuery) return true;
        return (
          comment.sourceText.toLowerCase().includes(trimmedQuery) ||
          comment.body.toLowerCase().includes(trimmedQuery)
        );
      })
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
      .map<AiCommentPanelRow>((comment) => ({
        id: comment.id,
        kind: comment.kind,
        sourceText: comment.sourceText,
        body: comment.body,
        chapterLabel:
          chapterLabelById.get(comment.locator?.chapterId ?? "") ??
          t("unknownChapter"),
        status: comment.status,
      }));
  }, [
    activeFilterId,
    chapterIndexById,
    chapterLabelById,
    comments,
    searchQuery,
    t,
  ]);

  return {
    activeFilterId,
    setActiveFilterId,
    searchQuery,
    setSearchQuery,
    total: comments.length,
    counts,
    visibleComments,
    deleteAiComment,
  };
}
