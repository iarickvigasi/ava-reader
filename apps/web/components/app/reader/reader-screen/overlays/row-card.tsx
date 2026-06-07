import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { useRef } from "react";
import { cn } from "@/lib/cn";
import { useDismissOnOutsideClick } from "./use-dismiss-on-outside-click";

type RowCardProps = {
  // Tailwind group name (e.g. "highlight-row"), so hover-reveal children can
  // target this row via `group-hover/<group>`.
  group: string;
  isMenuOpen: boolean;
  onMenuClose: () => void;
  onSelect?: () => void;
  className?: string;
  children: ReactNode;
};

// Shared panel-row shell: the focusable card, its base styling, and the
// dismiss-menu-on-outside-click + keyboard-select behaviour reused by the
// highlights and AI-comments overlays.
export function RowCard({
  group,
  isMenuOpen,
  onMenuClose,
  onSelect,
  className,
  children,
}: RowCardProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  useDismissOnOutsideClick(rowRef, isMenuOpen, onMenuClose);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
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
      onKeyDown={onSelect ? handleKeyDown : undefined}
      className={cn(
        `group/${group} relative flex flex-col gap-2 rounded-[10px] px-3 py-2 text-left transition`,
        onSelect &&
          "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line/60",
        isMenuOpen ? "bg-soft-tone-fill/60" : "hover:bg-soft-tone-fill/45",
        className,
      )}
    >
      {children}
    </div>
  );
}
