import { useTranslations } from "next-intl";
import { CATALOG_FILTERS } from "@/features/explore/catalog-filters";
import { FilterPill } from "./filter-pill";

export function CategoryPills({
  filters,
  toggle,
}: {
  filters: string[];
  toggle: (key: "languages" | "filters", value: string) => void;
}) {
  const t = useTranslations("explore");
  return (
    <div
      role="group"
      aria-label={t("filtersLabel")}
      className="flex min-w-0 flex-col gap-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-row sm:overflow-x-auto"
    >
      {[CATALOG_FILTERS.slice(0, 8), CATALOG_FILTERS.slice(8)].map(
        (row, index) => (
          <div
            key={index}
            className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:contents"
          >
            {row.map((filter) => (
              <FilterPill
                key={filter}
                active={filters.includes(filter)}
                onClick={() => toggle("filters", filter)}
              >
                {t(`filters.${filter}`)}
              </FilterPill>
            ))}
          </div>
        ),
      )}
    </div>
  );
}
