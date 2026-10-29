import { ModalActions } from "@/components/ui/modal-actions";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { PendingLabel } from "@/components/app/shared/pending-label";
import { EditorialModalShell } from "../admin/editorial-modal-shell";
import { WorkPicker } from "./work-picker";
import { EditionSearch } from "./edition-search";
import { useEditionWorkDialog } from "@/features/explore/linking/use-edition-work-dialog";
export function EditionWorkDialog({
  kind,
  id,
  close,
}: {
  kind: string;
  id: string;
  close: () => void;
}) {
  const t = useTranslations("explore.linkDialog");
  const state = useEditionWorkDialog(kind, id, close);
  return (
    <EditorialModalShell
      title={t(kind === "works" ? "attachTitle" : "changeTitle")}
      close={() => {
        if (!state.pending) close();
      }}
    >
      <div className="space-y-6">
        <p>{t(kind === "works" ? "attachHelp" : "changeHelp")}</p>
        {kind === "works" ? (
          <EditionSearch choose={state.setEdition} />
        ) : (
          <WorkPicker choose={state.setWork} />
        )}
        {state.edition && state.work && (
          <p>
            {t("summary", {
              edition: state.edition.title,
              work: state.work.originalTitle,
            })}
          </p>
        )}
        {state.error && <p role="alert">{state.error}</p>}
        <ModalActions
          cancelLabel={t("cancel")}
          onCancel={close}
          pending={state.pending}
        >
          <Button
            size="sm"
            disabled={!state.work || !state.edition || state.pending}
            onClick={() => void state.save()}
          >
            <PendingLabel pending={state.pending} pendingText={t("linking")}>
              {t("confirm")}
            </PendingLabel>
          </Button>
        </ModalActions>
      </div>
    </EditorialModalShell>
  );
}
