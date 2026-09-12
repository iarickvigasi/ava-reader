import { useTranslations } from "next-intl";
import type { CommentStatusLabels } from "./types";

export function useCommentStatusLabels(): CommentStatusLabels {
  const tools = useTranslations("reader.aiTools");
  const comments = useTranslations("reader.aiComments");
  return {
    queued: tools("queued"),
    generating: tools("generating"),
    failed: tools("errors.generic"),
    empty: comments("emptyBody"),
  };
}
