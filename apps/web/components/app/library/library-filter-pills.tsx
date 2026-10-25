import { useTranslations } from "next-intl";
import { FilterPill } from "@/components/app/shared/filter-pill";
import {
  SOURCE_FILTERS,
  PROGRESS_FILTERS,
  type LibraryFilter,
} from "@/features/library/library-filters";

export function LibraryFilterPills({
  filters,
  toggle,
}: {
  filters: LibraryFilter[];
  toggle: (filter: LibraryFilter) => void;
}) {
  const t = useTranslations("library.filters");
  return (
    <div
      role="group"
      aria-label={t("label")}
      className="flex min-w-0 flex-col gap-2 sm:flex-row sm:overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {[["offline", ...SOURCE_FILTERS], PROGRESS_FILTERS].map((row, index) => (
        <div
          key={index}
          className="flex gap-2 overflow-x-auto pb-2 sm:contents [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {row.map((filter) => (
            <FilterPill
              key={filter}
              active={filters.includes(filter as LibraryFilter)}
              onClick={() => toggle(filter as LibraryFilter)}
            >
              {t(filter)}
            </FilterPill>
          ))}
        </div>
      ))}
    </div>
  );
}
