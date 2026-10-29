import { useLocale, useTranslations } from "next-intl";
import type { CatalogEditionDetail } from "@/lib/catalog-types";
import { MetadataItem } from "@/components/app/shared/books/metadata-item";
import { useEditionReviewEvidence } from "@/features/explore/admin/use-edition-review-evidence";
import { EditionRightsInformation } from "./edition-rights-information";
export function EditionSourceInformation({
  edition,
}: {
  edition: Pick<CatalogEditionDetail, "importEvidence"> &
    Pick<Partial<CatalogEditionDetail>, "id">;
}) {
  const t = useTranslations("explore.editionSource");
  const locale = useLocale();
  const review = useEditionReviewEvidence(edition.id);
  return (
    edition.importEvidence?.map((evidence) => {
      const detail = review?.importEvidence?.find(
        (item) => item.checksum === evidence.checksum,
      );
      return (
        <section
          key={evidence.checksum}
          className="space-y-6 border-t border-line/30 pt-6"
        >
          <div className="grid grid-cols-2 gap-x-12 gap-y-10">
            <MetadataItem
              label={t("source")}
              value={
                <a
                  href={evidence.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-plum underline"
                >
                  {t(`providers.${evidence.provider}`)}
                </a>
              }
            />
            <MetadataItem
              label={t("file")}
              value={
                <a
                  href={evidence.downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-plum underline"
                >
                  {evidence.filename}
                </a>
              }
            />
            {detail && (
              <MetadataItem
                label={t("inspected")}
                value={new Intl.DateTimeFormat(locale, {
                  dateStyle: "medium",
                }).format(new Date(detail.inspectedAt))}
              />
            )}
          </div>
          {detail && (
            <EditionRightsInformation
              key={detail.checksum}
              research={detail.research}
              approval={review?.readingAssets?.find(
                (asset) => asset.checksum === evidence.checksum,
              )}
            />
          )}
        </section>
      );
    }) ?? null
  );
}
