import type { ReadingDetails } from "@/features/explore/use-reading-details";
import { CatalogReadingEstimates } from "./catalog-reading-estimates";
import { useLocale, useTranslations } from "next-intl";
import type { CatalogEdition } from "@/lib/catalog-types";
import { languageName } from "@/features/explore/catalog-display";
import { MetadataItem } from "@/components/app/shared/books/metadata-item";
import { BookAuthors } from "@/components/app/shared/books/book-authors";

export function EditionDetails({
  edition,
  readingDetails = null,
}: {
  edition: CatalogEdition;
  readingDetails?: ReadingDetails | null;
}) {
  const t = useTranslations("explore");
  const locale = useLocale();
  return (
    <div className="space-y-10">
      <div className="grid grid-cols-2 gap-x-12 gap-y-10">
        {edition.language && (
          <MetadataItem
            label={t("metadata.language")}
            value={languageName(edition.language, locale)}
          />
        )}
        {edition.publisher && (
          <MetadataItem
            label={t("metadata.publisher")}
            value={edition.publisher}
          />
        )}
        {edition.publishedYear && (
          <MetadataItem
            label={t("metadata.published")}
            value={edition.publishedYear}
          />
        )}
        {edition.format !== "UNKNOWN" && (
          <MetadataItem
            label={t("metadata.format")}
            value={t(`formats.${edition.format}`)}
          />
        )}
        {edition.identifiers.map(({ identifier }) => (
          <MetadataItem
            key={`${identifier.scheme}-${identifier.normalizedValue}`}
            label={identifier.scheme.replace("ISBN_", "ISBN-")}
            value={identifier.normalizedValue}
          />
        ))}
      </div>
      <CatalogReadingEstimates estimates={readingDetails} />
      {edition.credits
        .filter((credit) => credit.role !== "AUTHOR")
        .map((credit) => (
          <div key={`${credit.role}-${credit.author.id}`}>
            <p className="text-xs uppercase tracking-wide text-muted">
              {t(`roles.${credit.role}`)}
            </p>
            <BookAuthors
              authors={[
                {
                  id: credit.author.id,
                  name: credit.creditedAs ?? credit.author.displayName,
                },
              ]}
              className="text-base md:text-lg"
            />
          </div>
        ))}
    </div>
  );
}
