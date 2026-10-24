import { useLocale, useTranslations } from "next-intl";
import { languageName } from "@/features/explore/catalog-display";
import { FilterPill } from "./filter-pill";

import { CategoryPills } from "./category-pills";

export function ExploreFilters({
  filters,
  languages,
  available,
  toggle,
  ready = true,
}: {
  filters: string[];
  languages: string[];
  available: string[];
  ready?: boolean;
  toggle: (key: "languages" | "filters", value: string) => void;
}) {
  const t = useTranslations("explore");
  const locale = useLocale();
  return (
    <div className="space-y-5">
      <CategoryPills filters={filters} toggle={toggle} />
      <div
        role="group"
        aria-label={t("languages")}
        className="flex min-w-0 items-center gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <span className="mr-2 shrink-0 whitespace-nowrap text-xs font-semibold uppercase tracking-[0.16em] text-muted">
          {t("languages")}
        </span>
        {[...new Set([...available, ...languages])].map((language) => (
          <FilterPill
            key={language}
            active={languages.includes(language)}
            onClick={() => toggle("languages", language)}
          >
            {languageName(language, locale)}
          </FilterPill>
        ))}
        {ready && !available.length && !languages.length && (
          <span className="shrink-0 whitespace-nowrap text-sm text-muted">
            {t("noLanguages")}
          </span>
        )}
      </div>
    </div>
  );
}
