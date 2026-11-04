import { useShowCatalogAdmin } from "@/features/explore/admin/catalog-admin-visibility-context";
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
  const admin = useShowCatalogAdmin();
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
