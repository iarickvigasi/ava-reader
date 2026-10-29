import { useTranslations } from "next-intl";
import { ModalActions } from "@/components/ui/modal-actions";
import { Button } from "@/components/ui/button";
import { PendingLabel } from "@/components/app/shared/pending-label";
import type { ReadingReview } from "@/lib/api-types/reading-review";
export function PublicationActions({
  entry,
  close,
  pending,
}: {
  entry: ReadingReview;
  close: () => void;
  pending: boolean;
}) {
  const t = useTranslations("explore.publication");
  const published = entry.status === "PUBLISHED" && !entry.syncPending;
  return (
    <ModalActions cancelLabel="Cancel" onCancel={close} pending={pending}>
      {entry.status !== "PUBLISHED" && (
        <Button
          size="sm"
          type="submit"
          name="action"
          value="defer"
          formNoValidate
          disabled={pending}
        >
          {t("defer")}
        </Button>
      )}
      {published && (
        <Button
          size="sm"
          type="submit"
          name="action"
          value="unpublish"
          formNoValidate
          disabled={pending}
        >
          {t("unpublish")}
        </Button>
      )}
      <Button
        size="sm"
        type="submit"
        name="action"
        value="publish"
        disabled={pending}
      >
        <PendingLabel pending={pending} pendingText="Publishing">
          {published
            ? t("saveReview")
            : entry.syncPending && entry.status === "PUBLISHED"
              ? "Retry publication"
              : entry.withdrawn
                ? "Restore and publish"
                : "Publish"}
        </PendingLabel>
      </Button>
    </ModalActions>
  );
}
