import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import {
  RowActionsMenu,
  RowActionsMenuTrigger,
} from "./highlights-fields";
import type { Highlight } from "./highlights-data";

type HighlightRowProps = {
  highlight: Highlight;
  isMenuOpen: boolean;
  onMenuClose: () => void;
  onMenuToggle: () => void;
  onDelete?: () => void;
  onSelect?: () => void;
};

export function HighlightRow({
  highlight,
  isMenuOpen,
  onMenuClose,
  onMenuToggle,
  onDelete,
  onSelect,
}: HighlightRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);

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

  return (
    <div
      ref={rowRef}
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onClick={onSelect}
      onKeyDown={onSelect ? handleCardKeyDown : undefined}
      className={cn(
        "group/highlight-row relative flex flex-col gap-2 rounded-[10px] px-3 py-2 text-left transition",
        onSelect && "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line/60",
        isMenuOpen ? "bg-soft-tone-fill/60" : "hover:bg-soft-tone-fill/45",
      )}
    >
      <p className="min-w-0 font-(--font-display) text-[1rem] leading-[1.3] text-title">
        {highlight.text}
      </p>
      <div className="flex items-center justify-between gap-2">
        <span className="font-(--font-ui) text-[0.72rem] text-muted">
          {highlight.chapterLabel}
        </span>
        <RowActionsMenuTrigger
          ariaLabel={`More options for highlight in ${highlight.chapterLabel}`}
          isOpen={isMenuOpen}
          onToggle={onMenuToggle}
        />
      </div>
      {isMenuOpen ? (
        <div onClick={(event) => event.stopPropagation()}>
          <RowActionsMenu onDelete={onDelete} />
        </div>
      ) : null}
    </div>
  );
}
