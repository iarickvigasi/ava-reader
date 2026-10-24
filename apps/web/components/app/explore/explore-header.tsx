import { useTranslations } from "next-intl";
import type { useExplore } from "@/features/explore/use-explore";
import { PageHeader } from "@/components/app/shared/page-header";
import { SearchField } from "@/components/app/shared/search-field";
import { ExploreIcon } from "@/components/app/core/explore-icon";
import { ExploreFilters } from "./explore-filters";

export function ExploreHeader({
  state,
}: {
  state: ReturnType<typeof useExplore>;
}) {
  const t = useTranslations("explore");
  return (
    <>
      <PageHeader
        icon={ExploreIcon}
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("body")}
        titleId="explore-title"
      />
      <SearchField
        label={t("searchLabel")}
        placeholder={t("searchPlaceholder")}
        value={state.query}
        maxLength={200}
        onChange={(event) => state.setQuery(event.target.value)}
        className="w-full sm:max-w-xl"
      />
      <ExploreFilters
        filters={state.filters}
        languages={state.languages}
        available={state.languagesAvailable}
        ready={state.languagesReady}
        toggle={state.toggle}
      />
    </>
  );
}
