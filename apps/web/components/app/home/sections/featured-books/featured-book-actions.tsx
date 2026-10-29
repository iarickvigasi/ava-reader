import { CatalogAddButton } from "./catalog-add-button";
import { FeaturedReadButton } from "./featured-read-button";

export function FeaturedBookActions({
  entryId,
  libraryItemId,
}: {
  entryId: string;
  libraryItemId?: string | null;
}) {
  return (
    <div className="@container grid grid-cols-2 items-start gap-3">
      <FeaturedReadButton entryId={entryId} />
      <CatalogAddButton
        className="h-full min-w-0"
        entryId={entryId}
        libraryItemId={libraryItemId}
      />
    </div>
  );
}
