import type { AiCommentRecord } from "@/features/offline/buckets/ai-comments";
import type { HighlightRecord } from "@/features/offline/buckets/highlights";

export type BookAnnotationLists = {
  highlights: readonly HighlightRecord[];
  comments: readonly AiCommentRecord[];
  chapterLabels: ReadonlyMap<string, string>;
};

export type CommentStatusLabels = {
  queued: string;
  generating: string;
  failed: string;
  empty: string;
};

export type CommentListLabels = {
  kinds: Record<AiCommentRecord["kind"], string>;
  statuses: CommentStatusLabels;
};

export type AnnotationCopyMessages = {
  success: string;
  failure: string;
};
