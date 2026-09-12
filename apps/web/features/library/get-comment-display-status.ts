import type { AiCommentRecord } from "@/features/offline/buckets/ai-comments";
import type { CommentStatusLabels } from "./types";

export function getCommentDisplayStatus(comment: AiCommentRecord, labels: CommentStatusLabels) {
  if (comment.status === "queued") return labels.queued;
  if (comment.status === "streaming") return labels.generating;
  if (comment.status === "failed") return comment.error || labels.failed;
  return comment.body ? null : labels.empty;
}
