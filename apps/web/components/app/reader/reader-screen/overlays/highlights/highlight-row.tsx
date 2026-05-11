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

  return (
    <div
      ref={rowRef}
      className={cn(
        "group/highlight-row relative flex flex-col gap-2 rounded-[10px] px-3 py-2 transition",
        isMenuOpen ? "bg-soft-tone-fill/60" : "hover:bg-soft-tone-fill/45",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="min-w-0 text-left"
      >
        <p className="font-(--font-display) text-[1rem] leading-[1.3] text-title">
          {highlight.text}
        </p>
      </button>
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
      {isMenuOpen ? <RowActionsMenu onDelete={onDelete} /> : null}
    </div>
  );
}
