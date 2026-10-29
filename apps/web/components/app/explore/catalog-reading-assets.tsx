import { useTranslations } from "next-intl";
import type { CatalogReadingAsset } from "@/lib/catalog-types";
import { CatalogReadButton } from "./catalog-read-button";

export function CatalogReadingAssets({
  assets = [],
}: {
  assets?: CatalogReadingAsset[];
}) {
  const t = useTranslations("explore");
  if (!assets.length)
    return <p className="text-sm text-muted">{t("metadataOnly")}</p>;
  return (
    <div className="space-y-5">
      {assets.map((asset) => (
        <section key={asset.id} className="space-y-3">
          {assets.length > 1 && (
            <p className="font-reader text-lg text-copy">
              {asset.edition.title}
            </p>
          )}
          <CatalogReadButton entryId={asset.mainCatalogEntryId} />
        </section>
      ))}
    </div>
  );
}
