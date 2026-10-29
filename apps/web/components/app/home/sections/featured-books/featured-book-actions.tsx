import { CatalogAddButton } from "./catalog-add-button";
import { FeaturedReadButton } from "./featured-read-button";

export function FeaturedBookActions({ entryId }: { entryId: string }) {
  return (
    <div className="@container grid grid-cols-2 items-start gap-3">
      <FeaturedReadButton entryId={entryId} />
      <CatalogAddButton className="h-full min-w-0" entryId={entryId} />
    </div>
  );
}
