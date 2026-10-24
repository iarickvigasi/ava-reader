import { useLocale, useTranslations } from "next-intl";
import type { CatalogWork, CatalogEdition } from "@/lib/catalog-types";
import { catalogTitle, languageName } from "@/features/explore/catalog-display";
import { catalogCover } from "@/features/explore/catalog-cover";
import { BookCoverPanel } from "@/components/app/shared/books/book-cover-panel";
import { BookTitle } from "@/components/app/shared/books/book-title";
import { BookAuthors } from "@/components/app/shared/books/book-authors";
import { MetadataItem } from "@/components/app/shared/books/metadata-item";
import { CatalogReadingAssets } from "./catalog-reading-assets";

export function CatalogBookHero({
  work,
  edition,
}: {
  work: CatalogWork;
  edition?: Pick<
    CatalogEdition,
    "id" | "language" | "format" | "publishedYear"
  >;
}) {
  const t = useTranslations("explore");
  const locale = useLocale();
  const asset = work.readingAssets?.find(
    (item) => item.edition.id === edition?.id,
  );
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
        <CatalogReadingAssets assets={work.readingAssets} />
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
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
        {asset && (
          <a
            href={asset.rightsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-block text-sm text-plum underline"
          >
            {asset.rightsStatement} ({asset.rightsJurisdiction})
          </a>
        )}
      </div>
    </section>
  );
}
