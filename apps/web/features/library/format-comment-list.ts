import type { AiCommentRecord } from "@/features/offline/buckets/ai-comments";
import { getCommentDisplayStatus } from "./get-comment-display-status";
import type { CommentListLabels } from "./types";

export function formatCommentList(
  comments: readonly AiCommentRecord[],
  chapterLabels: ReadonlyMap<string, string>,
  labels: CommentListLabels,
): string {
  return comments.map((comment) => [
    [labels.kinds[comment.kind], chapterLabels.get(comment.locator?.chapterId ?? "")]
      .filter(Boolean).join(" · "),
    comment.sourceText,
    comment.body,
    getCommentDisplayStatus(comment, labels.statuses),
  ].filter(Boolean).join("\n\n")).join("\n\n---\n\n");
}
