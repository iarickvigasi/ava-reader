"use client";

import { useExploreReturn } from "@/features/explore/navigation/use-explore-return";
import { catalogHref } from "@/features/explore/navigation/catalog-href";
import { useLocale, useTranslations } from "next-intl";
import type { CatalogWork } from "@/lib/catalog-types";
import { catalogCover } from "@/features/explore/metadata/catalog-cover";
import { catalogTitle } from "@/features/explore/metadata/catalog-title";
import { BookCard } from "@/components/app/shared/books/book-card";

export function CatalogBookCard({
  work,
  uniformCover = false,
}: {
  work: CatalogWork;
  uniformCover?: boolean;
}) {
  const locale = useLocale();
  const returnHref = useExploreReturn();
  const t = useTranslations("explore");
  const authors = work.credits
    .filter((credit) => credit.role === "AUTHOR")
    .map((credit) => ({
      id: credit.author.id,
      name: credit.creditedAs ?? credit.author.displayName,
    }));
  return (
    <BookCard
      uniformCover={uniformCover}
      catalogWorkId={work.id}
      title={catalogTitle(work, locale)}
      authors={authors.length ? authors : [{ name: t("unknownAuthor") }]}
      href={catalogHref(`/app/explore/books/${work.id}`, returnHref)}
      coverImageUrl={catalogCover(work)}
    />
  );
}
