import { useTranslations } from "next-intl";
import type { HighlightColor } from "@/lib/highlights-store";
import { ColorFilterChip } from "./highlights-fields";
import {
  HIGHLIGHT_COLOR_ORDER,
  type HighlightFilter,
} from "./highlights-data";

type FilterId = HighlightFilter["id"];

type FiltersSectionProps = {
  counts: Record<HighlightColor, number>;
  total: number;
  activeFilterId: FilterId;
  onChange: (next: FilterId) => void;
};

export function FiltersSection({
  counts,
  total,
  activeFilterId,
  onChange,
}: FiltersSectionProps) {
  const t = useTranslations("reader.highlights");
  const filters: HighlightFilter[] = [
    { id: "all", label: t("filterAll"), count: total },
    ...HIGHLIGHT_COLOR_ORDER.filter((color) => counts[color] > 0).map(
      (color) => ({
        id: color,
        label: t(`color.${color}`),
        count: counts[color],
      }),
    ),
  ];

  return (
    <section className="flex flex-wrap gap-3">
      {filters.map((filter) => (
        <ColorFilterChip
          key={filter.id}
          filter={filter}
          isActive={activeFilterId === filter.id}
          onSelect={() => onChange(filter.id)}
        />
      ))}
    </section>
  );
}
