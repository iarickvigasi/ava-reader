import { useIsCatalogAdmin } from "@/features/explore/admin/use-is-catalog-admin";
import type { CatalogEditionDetail } from "@/lib/catalog-types";
import { workDescriptionTexts } from "@/features/explore/work-description-texts";
import { CatalogDetailsSection } from "./catalog-details-section";
import { CatalogAdminTools } from "./admin/catalog-admin-tools";
export function CatalogEditionActions({
  edition,
  description,
}: {
  edition: CatalogEditionDetail;
  description?: string | null;
}) {
  const admin = useIsCatalogAdmin();
  const texts = workDescriptionTexts([], description, edition.language);
  if (!admin && !texts.length) return null;
  return (
    <CatalogDetailsSection texts={texts}>
      <CatalogAdminTools
        kind="editions"
        id={edition.id}
        workId={edition.work.id}
      />
    </CatalogDetailsSection>
  );
}
