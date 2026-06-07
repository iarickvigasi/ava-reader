import type { MouseEvent as ReactMouseEvent } from "react";
import { cn } from "@/lib/cn";

export function AiCommentExpandToggle({
  isExpanded,
  onClick,
}: {
  isExpanded: boolean;
  onClick: (event: ReactMouseEvent<HTMLButtonElement>) => void;
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
