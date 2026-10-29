"use client";
import { useExploreReturn } from "@/features/explore/use-explore-return";
import { catalogHref } from "@/features/explore/explore-return";
import { useReadingDetails } from "@/features/explore/use-reading-details";
import { useTranslations } from "next-intl";
import { useCatalogLocation } from "@/features/explore/use-catalog-location";
import { useCatalogResource } from "@/features/explore/use-catalog-resource";
import type { CatalogEditionDetail } from "@/lib/catalog-types";
import { ScreenContainer } from "@/components/ui/screen-container";
import { BookBackLink } from "@/components/app/shared/books/book-back-link";
import { CatalogStatus } from "./catalog-status";
import { CatalogBookSkeleton } from "./catalog-book-skeleton";
import { CatalogEditionHero } from "./catalog-edition-hero";
import { CatalogEditionActions } from "./catalog-edition-actions";

export function CatalogEditionScreen() {
  const t = useTranslations("explore");
  const returnHref = useExploreReturn();
  const id = useCatalogLocation("editions");
  const readingDetails = useReadingDetails(id ?? undefined);
  const state = useCatalogResource<CatalogEditionDetail>(
    id ? `editions/${id}` : null,
  );
  return (
    <ScreenContainer className="gap-8 py-10 sm:py-16">
      <BookBackLink
        href={
          state.data
            ? catalogHref(
                `/app/explore/books/${state.data.work.id}`,
                returnHref,
              )
            : returnHref
        }
      >
        {state.data
          ? t("backToWork", { title: state.data.work.originalTitle })
          : t("backToExplore")}
      </BookBackLink>
      <CatalogStatus {...state} loading={false} />
      {state.loading && !state.data && <CatalogBookSkeleton />}
      {state.data && (
        <>
          <CatalogEditionHero
            edition={state.data}
            readingDetails={readingDetails}
          />
          <CatalogEditionActions
            edition={state.data}
            description={readingDetails?.description}
          />
        </>
      )}
    </ScreenContainer>
  );
}
