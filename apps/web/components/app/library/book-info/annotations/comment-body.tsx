import { useTranslations } from "next-intl";
import type { AiCommentRecord } from "@/features/offline/buckets/ai-comments";

export function CommentBody({ comment }: { comment: AiCommentRecord }) {
  const t = useTranslations("reader.aiTools");
  const comments = useTranslations("reader.aiComments");
  const status = comment.status === "queued" ? t("queued")
    : comment.status === "streaming" ? t("generating")
    : comment.status === "failed" ? comment.error || t("errors.generic") : null;
  return (
    <div className="space-y-2">
      {comment.body ? (
        <p className="whitespace-pre-wrap break-words font-reader text-base leading-relaxed text-copy">
          {comment.body}
        </p>
      ) : null}
      {status || !comment.body ? (
        <p role="status" className="font-ui text-sm text-muted">
          {status || comments("emptyBody")}
        </p>
      ) : null}
    </div>
  );
}
