import { ModalActions } from "@/components/ui/modal-actions";
import { Button } from "@/components/ui/button";
import { PendingLabel } from "@/components/app/shared/pending-label";
import { EditorialModalShell } from "../admin/editorial-modal-shell";
import { UploadPicker } from "./upload-picker";
import { WorkPicker } from "./work-picker";
import { usePrivateLinkDialog } from "@/features/explore/linking/use-private-link-dialog";
import type { CatalogWork } from "@/lib/catalog-types";
export function PrivateLinkDialog({
  libraryItemId,
  work,
  close,
}: {
  libraryItemId?: string;
  work?: CatalogWork;
  close: () => void;
}) {
  const state = usePrivateLinkDialog(libraryItemId, work, close);
  return (
    <EditorialModalShell
      title="Link a private reading copy"
      close={() => {
        if (!state.pending) close();
      }}
    >
      <div className="space-y-6">
        <p>
          Visible to you only. This link and your uploaded file are private,
          including from admins. It does not add an edition to the public
          catalog. Your progress, notes, and collections stay unchanged.
        </p>
        {!libraryItemId && (
          <UploadPicker uploads={state.uploads} choose={state.setId} />
        )}
        {!work && <WorkPicker choose={state.chooseWork} />}
        {state.work && <p>Selected work: {state.work.originalTitle}</p>}
        {state.error && <p role="alert">{state.error}</p>}
        <ModalActions
          cancelLabel="Cancel"
          onCancel={close}
          pending={state.pending}
        >
          <Button
            size="sm"
            disabled={!state.id || !state.work || state.pending}
            onClick={() => void state.save()}
          >
            <PendingLabel pending={state.pending} pendingText="Saving">
              Link book
            </PendingLabel>
          </Button>
        </ModalActions>
      </div>
    </EditorialModalShell>
  );
}
