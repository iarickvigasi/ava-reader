import type { AiCommentRecord } from "@/features/offline/buckets/ai-comments";
import { getCommentDisplayStatus } from "@/features/library/get-comment-display-status";
import { useCommentStatusLabels } from "@/features/library/use-comment-status-labels";

export function CommentBody({ comment }: { comment: AiCommentRecord }) {
  const labels = useCommentStatusLabels();
  const status = getCommentDisplayStatus(comment, labels);
  return (
    <div className="space-y-2">
      {comment.body ? (
        <p className="whitespace-pre-wrap break-words font-reader text-base leading-relaxed text-copy">
          {comment.body}
        </p>
      ) : null}
      {status ? (
        <p role="status" className="font-ui text-sm text-muted">
          {status}
        </p>
      ) : null}
    </div>
  );
}
