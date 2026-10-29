import type { CatalogReadingAsset } from "@/lib/catalog-types";
import { CatalogReadingAssets } from "../catalog-reading-assets";
import { useAdminCopies } from "@/features/explore/admin/use-admin-copies";
import { AdminReadingCopy } from "./admin-reading-copy";

export function AdminReadingCopies({
  workId,
  assets,
  editionId,
}: {
  workId: string;
  editionId?: string;
  assets?: CatalogReadingAsset[];
}) {
  const state = useAdminCopies(workId);
  const entries = state.entries?.filter(
    (entry) => !editionId || entry.editionId === editionId,
  );
  return (
    <div className="space-y-4">
      {(!!assets?.length ||
        !entries?.some((entry) => entry.status === "DRAFT")) && (
        <CatalogReadingAssets assets={assets} />
      )}
      {state.error && (
        <p role="alert" className="text-danger">
          {state.error}
        </p>
      )}
      {entries?.map((entry) => (
        <AdminReadingCopy key={entry.id} entry={entry} />
      ))}
    </div>
  );
}
