import { useState } from "react";
import { useTranslations } from "next-intl";
import { AiCommentRow } from "./ai-comment-row";
import type { AiCommentPanelRow } from "./ai-comments-data";

type AiCommentsListSectionProps = {
  comments: AiCommentPanelRow[];
  onDelete?: (id: string) => void;
  onSelect?: (id: string) => void;
};

export function AiCommentsListSection({
  comments,
  onDelete,
  onSelect,
}: AiCommentsListSectionProps) {
  const [openMenuCommentId, setOpenMenuCommentId] = useState<string | null>(
    null,
  );
  const t = useTranslations("reader.aiComments");

  if (comments.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center pb-8">
        <p className="font-(--font-ui) text-[0.78rem] uppercase tracking-[0.16em] text-muted">
          {t("empty")}
        </p>
      </div>
    );
  }

  return (
    <ul
      className="min-h-0 flex-1 space-y-2 overflow-auto pb-8 pr-2"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          setOpenMenuCommentId(null);
        }
      }}
    >
      {comments.map((comment) => (
        <li key={comment.id}>
          <AiCommentRow
            comment={comment}
            isMenuOpen={openMenuCommentId === comment.id}
            onMenuToggle={() =>
              setOpenMenuCommentId((current) =>
                current === comment.id ? null : comment.id,
              )
            }
            onMenuClose={() => setOpenMenuCommentId(null)}
            onDelete={
              onDelete
                ? () => {
                    onDelete(comment.id);
                    setOpenMenuCommentId(null);
                  }
                : undefined
            }
            onSelect={onSelect ? () => onSelect(comment.id) : undefined}
          />
        </li>
      ))}
    </ul>
  );
}
