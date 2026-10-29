import type { CatalogWork } from "@/lib/catalog-types";
import { workDescriptionTexts } from "@/features/explore/work-description-texts";
import { CatalogDetailsSection } from "./catalog-details-section";
import { CatalogAdminTools } from "./admin/catalog-admin-tools";
import { LinkPrivateCopy } from "./linking/link-private-copy";

export function CatalogBookActions({
  work,
  description,
  language,
}: {
  work: CatalogWork;
  description?: string | null;
  language?: string | null;
}) {
  const texts = workDescriptionTexts(work.texts, description, language);
  return (
    <CatalogDetailsSection texts={texts}>
      <LinkPrivateCopy work={work} />
      <CatalogAdminTools kind="works" id={work.id} />
    </CatalogDetailsSection>
  );
}
