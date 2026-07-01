import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import {
  AI_COMMENT_KIND_ORDER,
  type AiCommentFilter,
  type AiCommentKind,
  type AiCommentsFilterId,
} from "./ai-comments-data";

type AiCommentsFiltersSectionProps = {
  counts: Record<AiCommentKind, number>;
  total: number;
  activeFilterId: AiCommentsFilterId;
  onChange: (next: AiCommentsFilterId) => void;
};

export function AiCommentsFiltersSection({
  counts,
  total,
  activeFilterId,
  onChange,
}: AiCommentsFiltersSectionProps) {
  const t = useTranslations("reader.aiComments");
  // The "All" chip is always shown so the user can clear an active filter even
  // when the panel has zero rows for the current kind. Per-kind chips only
  // appear when at least one row exists to avoid noise on a fresh book.
  const filters: AiCommentFilter[] = [
    { id: "all", label: t("filterAll"), count: total },
    ...AI_COMMENT_KIND_ORDER.filter((kind) => counts[kind] > 0).map((kind) => ({
      id: kind,
      label: t(`kind.${kind}`),
      count: counts[kind],
    })),
  ];

  return (
    <section className="flex flex-wrap gap-3">
      {filters.map((filter) => (
        <AiCommentsFilterChip
          key={filter.id}
          filter={filter}
          isActive={activeFilterId === filter.id}
          onSelect={() => onChange(filter.id)}
        />
      ))}
    </section>
  );
}

function AiCommentsFilterChip({
  filter,
  isActive,
  onSelect,
}: {
  filter: AiCommentFilter;
  isActive: boolean;
  onSelect: () => void;
}) {
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
          isActive
            ? "bg-paper-strong text-ink"
            : "bg-brand-fill text-paper",
        )}
      >
        {filter.count}
      </span>
    </button>
  );
}
