"use client";

import { useHighlights } from "@/components/app/reader/overlays/highlights/use-highlights";
import { useAiComments } from "@/components/app/reader/overlays/ai-comments/use-ai-comments";
import { useCachedChapterLabels } from "@/features/library/use-cached-chapter-labels";
import { BookAnnotationsView } from "./book-annotations-view";

export function BookAnnotations({ libraryItemId }: { libraryItemId: string }) {
  const highlights = useHighlights(libraryItemId);
  const comments = useAiComments(libraryItemId);
  const chapterLabels = useCachedChapterLabels(libraryItemId);
  return (
    <BookAnnotationsView
      highlights={highlights.highlights}
      comments={comments.comments}
      chapterLabels={chapterLabels}
      highlightsStatus={highlights.loadStatus}
      commentsStatus={comments.loadStatus}
      deleteHighlight={highlights.deleteHighlight}
      deleteAiComment={comments.deleteAiComment}
      retryHighlights={highlights.refetch}
      retryComments={comments.refetch}
    />
  );
}
