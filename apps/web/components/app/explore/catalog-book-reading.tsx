import { useExploreReturn } from "@/features/explore/use-explore-return";
import { catalogHref } from "@/features/explore/explore-return";
import { TextActionLink } from "@/components/ui/text-action-link";
import { useTranslations } from "next-intl";
import type { CatalogWork } from "@/lib/catalog-types";
import { CatalogAdminReading } from "./admin/catalog-admin-reading";

export function CatalogBookReading({
  work,
  editionId,
}: {
  work: CatalogWork;
  editionId?: string;
}) {
  const t = useTranslations("explore");
  const returnHref = useExploreReturn();
  return (
    <div className="flex flex-wrap items-center gap-6">
      {editionId && (
        <TextActionLink
          href={catalogHref(`/app/explore/editions/${editionId}`, returnHref)}
          className="py-3"
        >
          {t("viewEdition")}
        </TextActionLink>
      )}
      <div className="min-w-64 flex-1">
        <CatalogAdminReading
          workId={work.id}
          assets={work.readingAssets}
          editionId={editionId}
        />
      </div>
    </div>
  );
}
