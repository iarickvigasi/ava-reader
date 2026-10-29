import type { ReadingReview } from "@/lib/api-types/reading-review";
import { CatalogReadButton } from "../catalog-read-button";

export function AdminReadingCopy({ entry }: { entry: ReadingReview }) {
  if (entry.status === "PUBLISHED" && !entry.syncPending) return null;
  return (
    <div className="space-y-3">
      {entry.error && (
        <p role="alert" className="text-danger">
          {entry.error}
        </p>
      )}
      {entry.processingStatus === "READY" && (
        <CatalogReadButton entryId={entry.id} draft={entry} />
      )}
    </div>
  );
}
