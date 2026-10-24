"use client";

import { useTranslations } from "next-intl";
import { useCatalogBook } from "@/features/explore/use-catalog-book";
import { useExploreReturn } from "@/features/explore/use-explore-return";
import { ScreenContainer } from "@/components/ui/screen-container";
import { Button } from "@/components/ui/button";
import { BookBackLink } from "@/components/app/shared/books/book-back-link";
import { CatalogDescription } from "./catalog-description";
import { CatalogBookSkeleton } from "./catalog-book-skeleton";
import { CatalogEditionsSkeleton } from "./catalog-editions-skeleton";
import { CatalogStatus } from "./catalog-status";
import { CatalogBookHero } from "./catalog-book-hero";
import { EditionDetails } from "./edition-details";

export function CatalogBookScreen() {
  const t = useTranslations("explore");
  const returnHref = useExploreReturn();
  const state = useCatalogBook();
  const work = state.work.data;
  if (state.work.loading && !work) return <CatalogBookSkeleton />;
  return (
    <ScreenContainer className="gap-10 py-10 sm:py-16">
      <BookBackLink href={returnHref}>{t("backToExplore")}</BookBackLink>
      <CatalogStatus {...state.work} loading={false} />
      {work && (
        <>
          <CatalogBookHero work={work} edition={state.selectedEdition} />
          <CatalogDescription key={work.id} texts={work.texts} />
          <CatalogStatus {...state.editions} loading={false} />
          {state.editions.loading && <CatalogEditionsSkeleton />}
          {state.items.length > 0 && (
            <section className="space-y-6">
              <h2 className="font-display text-4xl text-title">
                {t("editions")}
              </h2>
              <div className="grid gap-5 lg:grid-cols-2">
                {state.items.map((edition) => (
                  <EditionDetails key={edition.id} edition={edition} />
                ))}
              </div>
              {state.editions.data?.nextCursor && (
                <Button
                  variant="soft"
                  size="sm"
                  disabled={state.editions.loading}
                  onClick={state.next}
                >
                  {t("loadMore")}
                </Button>
              )}
            </section>
          )}
        </>
      )}
    </ScreenContainer>
  );
}
