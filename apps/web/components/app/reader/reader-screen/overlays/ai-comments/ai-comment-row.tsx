import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { RowActionsMenu } from "../row-actions-menu";
import { RowActionsMenuTrigger } from "../row-actions-menu-trigger";
import { RowCard } from "../row-card";
import { AiCommentExpandToggle } from "./ai-comment-expand-toggle";
import type { AiCommentPanelRow } from "./ai-comments-data";

type AiCommentRowProps = {
  comment: AiCommentPanelRow;
  isMenuOpen: boolean;
  onMenuClose: () => void;
  onMenuToggle: () => void;
  onDelete?: () => void;
  onSelect?: () => void;
};

export function AiCommentRow({
  comment,
  isMenuOpen,
  onMenuClose,
  onMenuToggle,
  onDelete,
  onSelect,
}: AiCommentRowProps) {
  const t = useTranslations("reader.aiComments");
  const [isExpanded, setIsExpanded] = useState(false);

  const kindLabel = t(`kind.${comment.kind}`);

  // Phase 5: queued / streaming comments render dimmed so the user can tell at
  // a glance which rows are local-only vs. server-confirmed; failed rows dim
  // more — they need attention.
  const isPending =
    comment.status === "queued" || comment.status === "streaming";
  const isFailed = comment.status === "failed";

  return (
    <RowCard
      group="ai-comment-row"
      isMenuOpen={isMenuOpen}
      onMenuClose={onMenuClose}
      onSelect={onSelect}
      className={cn(isPending && "opacity-80", isFailed && "opacity-50")}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-(--font-ui) text-[0.65rem] uppercase tracking-[0.18em] text-muted">
          {kindLabel} · {comment.chapterLabel}
        </span>
      </div>

      <div className="flex items-start gap-2">
        <p
          className={cn(
            "min-w-0 flex-1 font-(--font-display) text-[1rem] leading-[1.3] text-title",
            !isExpanded && "line-clamp-2",
          )}
        >
          {comment.sourceText}
        </p>
        <AiCommentExpandToggle
          isExpanded={isExpanded}
          onClick={(event) => {
            event.stopPropagation();
            setIsExpanded((current) => !current);
          }}
        />
        <RowActionsMenuTrigger
          ariaLabel={t("actionsLabel", { chapter: comment.chapterLabel })}
          group="ai-comment-row"
          isOpen={isMenuOpen}
          onToggle={onMenuToggle}
        />
      </div>

      {isExpanded ? (
        <div
          className="rounded-md border-l-2 border-brand-fill/70 bg-soft-tone-fill/45 px-3 py-2"
          onClick={(event) => event.stopPropagation()}
        >
          <p className="font-(--font-ui) text-[0.85rem] leading-[1.45] text-copy">
            {comment.body || t("emptyBody")}
          </p>
        </div>
      ) : null}

      {isMenuOpen ? (
        <div onClick={(event) => event.stopPropagation()}>
          <RowActionsMenu
            actions={[{ kind: "delete", label: t("delete"), onClick: onDelete }]}
          />
        </div>
      ) : null}
    </RowCard>
  );
}
