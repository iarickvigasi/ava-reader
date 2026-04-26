import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import {
  HighlightSwatch,
  RowActionsMenu,
  RowActionsMenuTrigger,
} from "./highlights-fields";
import type { Highlight } from "./highlights-data";

type HighlightRowProps = {
  highlight: Highlight;
  isMenuOpen: boolean;
  onMenuClose: () => void;
  onMenuToggle: () => void;
};

export function HighlightRow({
  highlight,
  isMenuOpen,
  onMenuClose,
  onMenuToggle,
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
        "group/highlight-row relative flex items-center gap-4 rounded-[10px] px-3 py-2 transition",
        isMenuOpen ? "bg-soft-tone-fill/60" : "hover:bg-soft-tone-fill/45",
      )}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <HighlightSwatch color={highlight.color} />
        <p className="min-w-0 flex-1 font-(--font-display) text-[1rem] leading-[1.3] text-title">
          {highlight.text}
        </p>
      </button>
      <div className="flex shrink-0 flex-col items-center justify-between self-stretch py-0.5">
        <RowActionsMenuTrigger
          ariaLabel={`More options for highlight on page ${highlight.pageNumber}`}
          isOpen={isMenuOpen}
          onToggle={onMenuToggle}
        />
        <span className="font-(--font-ui) text-[0.78rem] text-muted">
          {highlight.pageNumber}
        </span>
      </div>
      {isMenuOpen ? <RowActionsMenu /> : null}
    </div>
  );
}
