"use client";

import { useTranslations } from "next-intl";
import { useCatalogBook } from "@/features/explore/use-catalog-book";
import { useExploreReturn } from "@/features/explore/use-explore-return";
import { ScreenContainer } from "@/components/ui/screen-container";
import { BookBackLink } from "@/components/app/shared/books/book-back-link";
import { CatalogBookActions } from "./catalog-book-actions";
import { useReadingDetails } from "@/features/explore/use-reading-details";
import { CatalogBookSkeleton } from "./catalog-book-skeleton";
import { CatalogStatus } from "./catalog-status";
import { CatalogBookHero } from "./catalog-book-hero";

export function CatalogBookScreen() {
  const t = useTranslations("explore");
  const returnHref = useExploreReturn();
  const state = useCatalogBook();
  const work = state.work.data;
  const readingDetails = useReadingDetails(state.selectedEdition?.id);
  if (state.work.loading && !work) return <CatalogBookSkeleton />;
  return (
    <ScreenContainer className="gap-10 py-10 sm:py-16">
      <BookBackLink href={returnHref}>{t("backToExplore")}</BookBackLink>
      <CatalogStatus {...state.work} loading={false} />
      {work && (
        <>
          <CatalogBookHero
            work={work}
            edition={state.selectedEdition}
            readingDetails={readingDetails}
          />
          <CatalogBookActions
            key={work.id}
            work={work}
            description={readingDetails?.description}
            language={state.selectedEdition?.language}
          />
          <CatalogStatus {...state.editions} loading={false} />
        </>
      )}
    </ScreenContainer>
  );
}
