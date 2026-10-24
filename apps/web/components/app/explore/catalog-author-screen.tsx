"use client";

import { BookBackLink } from "@/components/app/shared/books/book-back-link";
import { Button } from "@/components/ui/button";
import { useExploreReturn } from "@/features/explore/use-explore-return";
import { CatalogBiography } from "./catalog-biography";
import { CatalogAuthorSkeleton } from "./catalog-author-skeleton";
import { BookCardSkeleton } from "@/components/app/shared/books/book-card-skeleton";
import { useLocale, useTranslations } from "next-intl";
import { useCatalogAuthor } from "@/features/explore/use-catalog-author";
import { catalogText } from "@/features/explore/catalog-display";
import { ScreenContainer } from "@/components/ui/screen-container";
import { BookTitle } from "@/components/app/shared/books/book-title";
import { CatalogBookCard } from "./catalog-book-card";
import { CatalogStatus } from "./catalog-status";

export function CatalogAuthorScreen() {
  const t = useTranslations("explore");
  const locale = useLocale();
  const state = useCatalogAuthor();
  const author = state.author.data;
  const returnHref = useExploreReturn();
  if (state.author.loading && !author) return <CatalogAuthorSkeleton />;
  return (
    <ScreenContainer className="gap-8 py-10 sm:py-16">
      <BookBackLink href={returnHref}>{t("backToExplore")}</BookBackLink>
      <CatalogStatus {...state.author} loading={false} />
      {author && (
        <>
          <BookTitle>{author.displayName}</BookTitle>
          {catalogText(author.texts, locale)?.biography && (
            <CatalogBiography
              biography={catalogText(author.texts, locale)!.biography!}
            />
          )}
          <h2 className="font-display text-4xl text-title">
            {t("creditedWorks")}
          </h2>
          <CatalogStatus {...state.works} loading={false} />
          <section className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
            {state.items.map((work) => (
              <CatalogBookCard key={work.id} work={work} />
            ))}
            {state.works.loading &&
              [0, 1, 2, 3].map((key) => <BookCardSkeleton key={key} />)}
          </section>
          {!state.works.loading &&
            !state.works.error &&
            state.items.length === 0 && (
              <p className="text-muted">{t("noWorks")}</p>
            )}
          {state.works.data?.nextCursor && (
            <Button
              variant="soft"
              size="sm"
              disabled={state.works.loading}
              onClick={state.next}
            >
              {t("loadMore")}
            </Button>
          )}
        </>
      )}
    </ScreenContainer>
  );
}
