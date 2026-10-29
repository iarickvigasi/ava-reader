import { PublicationActions } from "./publication-actions";
import { useTranslations } from "next-intl";
import type { ReadingReview } from "@/lib/api-types/reading-review";
import { usePublishDialog } from "@/features/explore/admin/use-publish-dialog";
import { ReviewFields } from "@/components/app/admin/reviews/review-fields";
import { EditorialModalShell } from "./editorial-modal-shell";

export function PublishDialog({
  entry,
  close,
}: {
  entry: ReadingReview;
  close: () => void;
}) {
  const t = useTranslations("explore.publication");
  const published = entry.status === "PUBLISHED" && !entry.syncPending;
  const state = usePublishDialog(entry, close);
  return (
    <EditorialModalShell
      title={t(published ? "unpublishTitle" : "publishTitle")}
      close={() => {
        if (!state.pending) close();
      }}
    >
      <form
        onSubmit={(event) => void state.publish(event)}
        className="space-y-5"
      >
        <p>
          {entry.title} · {entry.language}
        </p>
        <a
          href={entry.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="text-plum underline"
        >
          Source edition
        </a>
        <p className="break-all text-xs text-muted">
          {entry.filename} · SHA-256 {entry.checksum}
        </p>
        {!(entry.syncPending && entry.status === "PUBLISHED") && (
          <ReviewFields entry={entry} />
        )}
        {state.error && (
          <p role="alert" className="text-danger">
            {state.error}
          </p>
        )}
        <PublicationActions
          entry={entry}
          close={close}
          pending={state.pending}
        />
      </form>
    </EditorialModalShell>
  );
}
