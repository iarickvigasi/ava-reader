import { useTranslations } from "next-intl";
import { useState } from "react";
import { ActionCard } from "@/components/app/library/book-info/action-card";
import { UploadBoldIcon } from "@/components/app/library/book-info/upload-bold-icon";
import { useAdminCopies } from "@/features/explore/admin/use-admin-copies";
import type { ReadingReview } from "@/lib/api-types/reading-review";
import { PublishDialog } from "./publish-dialog";

export function CatalogPublicationControl({
  workId,
  editionId,
}: {
  workId: string;
  editionId?: string;
}) {
  const t = useTranslations("explore.adminActions");
  const { entries, error } = useAdminCopies(workId);
  const [chosen, setChosen] = useState<ReadingReview | null>(null);
  const copies =
    entries?.filter(
      (entry) =>
        entry.processingStatus === "READY" &&
        (!editionId || entry.editionId === editionId),
    ) ?? [];
  return (
    <div className="space-y-4">
      {!copies.length && (
        <ActionCard
          icon={UploadBoldIcon}
          title={t("publish")}
          disabled
          description={t(
            error
              ? "publishFailed"
              : entries === null
                ? "publishLoading"
                : "publishUnavailable",
          )}
        />
      )}
      {copies.map((entry) => {
        const published = entry.status === "PUBLISHED";
        const description = t(
          entry.syncPending
            ? "publishSyncPending"
            : published
              ? "unpublishDescription"
              : "publishDescription",
        );
        return (
          <ActionCard
            key={entry.id}
            icon={UploadBoldIcon}
            title={t(published ? "unpublish" : "publish")}
            description={
              copies.length > 1
                ? `${entry.title} · ${entry.language ?? ""} · ${entry.filename} · ${description}`
                : description
            }
            onClick={() => setChosen(entry)}
          />
        );
      })}
      {chosen && <PublishDialog entry={chosen} close={() => setChosen(null)} />}
    </div>
  );
}
