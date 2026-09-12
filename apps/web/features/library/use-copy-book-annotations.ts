"use client";

import { useTranslations } from "next-intl";
import { copyAnnotationText } from "./copy-annotation-text";
import { formatHighlightList } from "./format-highlight-list";
import { formatCommentList } from "./format-comment-list";
import { useCommentStatusLabels } from "./use-comment-status-labels";
import type { BookAnnotationLists } from "./types";

export function useCopyBookAnnotations({ highlights, comments, chapterLabels }: BookAnnotationLists) {
  const t = useTranslations("library.bookInfo.annotations");
  const commentsText = useTranslations("reader.aiComments");
  const statuses = useCommentStatusLabels();
  const copyHighlights = async (): Promise<void> => {
    if (!highlights.length) return;
    await copyAnnotationText(formatHighlightList(highlights, chapterLabels), {
      success: t("highlightsCopied"), failure: t("copyFailed"),
    });
  };
  const copyComments = async (): Promise<void> => {
    if (!comments.length) return;
    const text = formatCommentList(comments, chapterLabels, {
      kinds: {
        TRANSLATE: commentsText("kind.TRANSLATE"),
        EXPLAIN: commentsText("kind.EXPLAIN"),
        ETYMOLOGY: commentsText("kind.ETYMOLOGY"),
      },
      statuses,
    });
    await copyAnnotationText(text, { success: t("commentsCopied"), failure: t("copyFailed") });
  };
  return { copyHighlights, copyComments };
}
