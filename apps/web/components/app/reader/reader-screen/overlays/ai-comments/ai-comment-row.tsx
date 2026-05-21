import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { TrashIcon } from "@/components/app/shared/app-icons";
import { cn } from "@/lib/cn";
import { MoreVerticalIcon } from "../highlights/highlights-icons";
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
  const rowRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }
    const handleDocumentClick = (event: MouseEvent) => {
      if (
        rowRef.current &&
        !rowRef.current.contains(event.target as Node)
      ) {
        onMenuClose();
      }
    };
    document.addEventListener("mousedown", handleDocumentClick);
    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
    };
  }, [isMenuOpen, onMenuClose]);

  const handleCardKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!onSelect) {
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect();
    }
  };

  const kindLabel = t(`kind.${comment.kind}`);

  return (
    <div
      ref={rowRef}
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onClick={onSelect}
      onKeyDown={onSelect ? handleCardKeyDown : undefined}
      className={cn(
        "group/ai-comment-row relative flex flex-col gap-2 rounded-[10px] px-3 py-2 text-left transition",
        onSelect &&
          "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line/60",
        isMenuOpen ? "bg-soft-tone-fill/60" : "hover:bg-soft-tone-fill/45",
      )}
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
        <ExpandToggle
          isExpanded={isExpanded}
          onClick={(event) => {
            event.stopPropagation();
            setIsExpanded((current) => !current);
          }}
        />
        <RowActionsMenuTrigger
          ariaLabel={t("actionsLabel", { chapter: comment.chapterLabel })}
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
          <RowActionsMenu onDelete={onDelete} deleteLabel={t("delete")} />
        </div>
      ) : null}
    </div>
  );
}

function ExpandToggle({
  isExpanded,
  onClick,
}: {
  isExpanded: boolean;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      aria-label={isExpanded ? "Collapse comment" : "Expand comment"}
      aria-expanded={isExpanded}
      onClick={onClick}
      className={cn(
        "inline-flex size-6 shrink-0 items-center justify-center rounded-full text-ink/55 transition",
        "hover:bg-soft-tone-fill hover:text-ink",
      )}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={cn("size-4 transition-transform", isExpanded && "rotate-180")}
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
  );
}

function RowActionsMenuTrigger({
  ariaLabel,
  isOpen,
  onToggle,
}: {
  ariaLabel: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-haspopup="menu"
      aria-expanded={isOpen}
      aria-label={ariaLabel}
      className={cn(
        "inline-flex size-6 shrink-0 items-center justify-center rounded-full text-ink/55 transition",
        "hover:bg-soft-tone-fill hover:text-ink",
        "opacity-0 group-hover/ai-comment-row:opacity-100 focus:opacity-100",
        isOpen && "opacity-100 text-ink",
      )}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
    >
      <MoreVerticalIcon className="size-4" />
    </button>
  );
}

function RowActionsMenu({
  deleteLabel,
  onDelete,
}: {
  deleteLabel: string;
  onDelete?: () => void;
}) {
  return (
    <div
      role="menu"
      className="absolute right-2 top-full z-10 mt-1 w-36 rounded-[10px] border border-line/40 bg-paper-strong p-2 shadow-[-6px_6px_18px_rgba(31,27,24,0.10)]"
    >
      <button
        type="button"
        role="menuitem"
        onClick={onDelete}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left font-(--font-ui) text-[0.72rem] uppercase tracking-[0.16em] text-danger transition",
          "hover:bg-soft-tone-fill/80",
        )}
      >
        <span className="inline-flex size-5 items-center justify-center">
          <TrashIcon className="size-4" aria-hidden="true" />
        </span>
        {deleteLabel}
      </button>
    </div>
  );
}
