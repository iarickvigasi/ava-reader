import type { ReadingDetails } from "@/features/explore/use-reading-details";
import { CatalogReadingEstimates } from "./catalog-reading-estimates";
import { CatalogBookReading } from "./catalog-book-reading";
import { useLocale, useTranslations } from "next-intl";
import type { CatalogWork, CatalogEdition } from "@/lib/catalog-types";
import { catalogTitle, languageName } from "@/features/explore/catalog-display";
import { catalogCover } from "@/features/explore/catalog-cover";
import { BookCoverPanel } from "@/components/app/shared/books/book-cover-panel";
import { BookTitle } from "@/components/app/shared/books/book-title";
import { BookAuthors } from "@/components/app/shared/books/book-authors";
import { MetadataItem } from "@/components/app/shared/books/metadata-item";

export function CatalogBookHero({
  work,
  edition,
  readingDetails,
}: {
  work: CatalogWork;
  readingDetails: ReadingDetails | null;
  edition?: Pick<
    CatalogEdition,
    "id" | "language" | "format" | "publishedYear"
  >;
}) {
  const t = useTranslations("explore");
  const locale = useLocale();
  return (
    <section className="grid items-start gap-10 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:gap-16">
      <BookCoverPanel
        title={catalogTitle(work, locale)}
        coverImageUrl={catalogCover(work)}
      />
      <div className="space-y-7">
        {!!work.categories?.length && (
          <div className="flex flex-wrap gap-2">
            {work.categories.map((key) => (
              <span
                key={key}
                className="rounded-full bg-soft-fill px-3 py-2 font-ui text-[0.625rem] font-bold uppercase tracking-[0.16em] text-muted"
              >
                {t(`filters.${key}`)}
              </span>
            ))}
          </div>
        )}
        <BookTitle>{catalogTitle(work, locale)}</BookTitle>
        <BookAuthors
          authors={work.credits
            .filter((credit) => credit.role === "AUTHOR")
            .map((credit) => ({
              id: credit.author.id,
              name: credit.creditedAs ?? credit.author.displayName,
            }))}
        />
        <CatalogBookReading work={work} editionId={edition?.id} />
        <div className="space-y-10">
          <div className="grid grid-cols-2 gap-x-12 gap-y-10">
            {edition?.language && (
              <MetadataItem
                label={t("metadata.language")}
                value={languageName(edition.language, locale)}
              />
            )}
            {edition?.format && edition.format !== "UNKNOWN" && (
              <MetadataItem
                label={t("metadata.format")}
                value={t(`formats.${edition.format}`)}
              />
            )}
            {edition?.publishedYear && (
              <MetadataItem
                label={t("metadata.published")}
                value={String(edition.publishedYear)}
              />
            )}
          </div>
          {edition && <CatalogReadingEstimates estimates={readingDetails} />}
        </div>
      </div>
    </section>
  );
}
