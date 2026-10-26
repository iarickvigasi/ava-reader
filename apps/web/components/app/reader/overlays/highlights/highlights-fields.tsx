import { cn } from "@/lib/cn";
import { HIGHLIGHT_COLOR_BG, type HighlightFilter } from "./highlights-data";

export function ColorFilterChip({
  filter,
  isActive,
  onSelect,
}: {
  filter: HighlightFilter;
  isActive: boolean;
  onSelect: () => void;
}) {
  const badgeColor =
    filter.id === "all" ? "var(--paper-strong)" : HIGHLIGHT_COLOR_BG[filter.id];

  return (
    <button
      type="button"
      aria-pressed={isActive}
      onClick={onSelect}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-lg pl-2.5 pr-1 transition",
        isActive
          ? "bg-brand-fill text-paper"
          : "bg-soft-tone-fill text-muted hover:bg-soft-tone-fill/80",
      )}
    >
      <span className="font-ui text-[0.72rem] uppercase tracking-[0.14em]">
        {filter.label}
      </span>
      <span
        className={cn(
          "inline-flex size-6 items-center justify-center rounded-full text-[0.78rem] font-semibold",
          isActive ? "text-ink" : "text-muted",
        )}
        style={{ backgroundColor: badgeColor }}
      >
        {filter.count}
      </span>
    </button>
  );
}
