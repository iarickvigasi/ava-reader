import { useTranslations } from "next-intl";
import type { HighlightRecord } from "@/features/offline/buckets/highlights";
import type { AiCommentRecord } from "@/features/offline/buckets/ai-comments";
import type { AnnotationLoadStatus } from "@/features/annotations/annotation-sources";
import { useCopyBookAnnotations } from "@/features/library/use-copy-book-annotations";
import { AnnotationColumn } from "./annotation-column";
import { AnnotationRow } from "./annotation-row";
import { CommentBody } from "./comment-body";
import { AnnotationListState } from "./annotation-list-state";

type BookAnnotationsViewProps = {
  highlights: HighlightRecord[];
  comments: AiCommentRecord[];
  chapterLabels: Map<string, string>;
  highlightsStatus: AnnotationLoadStatus;
  commentsStatus: AnnotationLoadStatus;
  deleteHighlight: (id: string) => void;
  deleteAiComment: (id: string) => void;
  retryHighlights: () => void;
  retryComments: () => void;
};

export function BookAnnotationsView({
  highlights, comments, chapterLabels, highlightsStatus, commentsStatus,
  deleteHighlight, deleteAiComment, retryHighlights, retryComments,
}: BookAnnotationsViewProps) {
  const highlightsText = useTranslations("reader.highlights");
  const commentsText = useTranslations("reader.aiComments");
  const { copyHighlights, copyComments } = useCopyBookAnnotations({ highlights, comments, chapterLabels });
  return (
    <div className="grid items-start gap-10 border-t border-line/30 pt-10 lg:grid-cols-2 lg:gap-12 lg:pt-14">
      <AnnotationColumn title={highlightsText("title")} count={highlights.length} onCopy={copyHighlights}>
        {highlights.length ? (
          <ul className="divide-y divide-line/30">
            {highlights.map((highlight) => (
              <AnnotationRow
                key={highlight.id}
                text={highlight.excerpt}
                metadata={chapterLabels.get(highlight.locator?.chapterId ?? "")}
                onDelete={() => deleteHighlight(highlight.id)}
              />
            ))}
          </ul>
        ) : <AnnotationListState status={highlightsStatus} emptyLabel={highlightsText("empty")} onRetry={retryHighlights} />}
      </AnnotationColumn>
      <AnnotationColumn title={commentsText("title")} count={comments.length} onCopy={copyComments}>
        {comments.length ? (
          <ul className="divide-y divide-line/30">
            {comments.map((comment) => (
              <AnnotationRow
                key={comment.id}
                text={comment.sourceText}
                metadata={[
                  commentsText(`kind.${comment.kind}`),
                  chapterLabels.get(comment.locator?.chapterId ?? ""),
                ].filter(Boolean).join(" · ")}
                onDelete={() => void deleteAiComment(comment.id)}
              >
                <CommentBody comment={comment} />
              </AnnotationRow>
            ))}
          </ul>
        ) : <AnnotationListState status={commentsStatus} emptyLabel={commentsText("empty")} onRetry={retryComments} />}
      </AnnotationColumn>
    </div>
  );
}
