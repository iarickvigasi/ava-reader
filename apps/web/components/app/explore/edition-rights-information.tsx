import { useTranslations } from "next-intl";
import type { CatalogRightsResearch } from "@/lib/catalog-import-evidence";
import type { CatalogReadingAsset } from "@/lib/catalog-types";
import { MetadataItem } from "@/components/app/shared/books/metadata-item";
import { EditionResearchDetails } from "./edition-research-details";
export function EditionRightsInformation({
  research,
  approval,
}: {
  research: CatalogRightsResearch | null;
  approval?: CatalogReadingAsset;
}) {
  const t = useTranslations("explore.editionSource");
  return (
    <div className="space-y-6">
      <MetadataItem
        label={t("rightsStatus")}
        value={t(approval && !approval.reviewDeferred ? "approved" : "pending")}
      />
      {approval && !approval.reviewDeferred && (
        <div className="grid grid-cols-2 gap-x-12 gap-y-10">
          <MetadataItem
            label={t("approvedTerritories")}
            value={approval.rightsJurisdiction}
          />
          <MetadataItem
            label={t("approvedBasis")}
            value={
              <a
                href={approval.rightsUrl}
                target="_blank"
                rel="noreferrer"
                className="text-plum underline"
              >
                {approval.rightsStatement}
              </a>
            }
          />
        </div>
      )}
      {research ? (
        <EditionResearchDetails research={research} />
      ) : (
        <p className="text-sm text-muted">{t("noResearch")}</p>
      )}
    </div>
  );
}
