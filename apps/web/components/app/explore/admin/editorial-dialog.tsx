import { ModalActions } from "@/components/ui/modal-actions";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { PendingLabel } from "@/components/app/shared/pending-label";
import { useEditorialDialog } from "@/features/explore/admin/use-editorial-dialog";
import type { EditorialKind } from "@/features/explore/admin/types";
import { EditorialModalShell } from "./editorial-modal-shell";
import { EditorialFields } from "./editorial-fields";
import { EditorialProvenance } from "./editorial-provenance";

export function EditorialDialog({
  kind,
  id,
  remove = false,
  close,
}: {
  kind: EditorialKind;
  id: string;
  remove?: boolean;
  close: () => void;
}) {
  const t = useTranslations("explore.editorialForm");
  const actions = useTranslations("explore.adminActions");
  const state = useEditorialDialog(kind, id, remove, close);
  return (
    <EditorialModalShell
      title={
        remove
          ? t("deleteTitle")
          : kind === "authors"
            ? actions("editAuthor")
            : kind === "editions"
              ? actions("editEdition")
              : actions("editBook")
      }
      close={() => {
        if (!state.pending) close();
      }}
    >
      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          void state.save();
        }}
      >
        {remove && state.record && (
          <p className="font-reader text-xl">
            {String(state.record.originalTitle ?? state.record.title ?? "")}
          </p>
        )}
        {remove ? (
          <p>{t("deleteHelp")}</p>
        ) : (
          state.record && (
            <EditorialFields
              kind={kind}
              data={state.data}
              change={state.change}
            />
          )
        )}
        {state.record && <EditorialProvenance record={state.record} />}
        {!state.record && !state.error && <p>{t("loading")}</p>}
        {state.error && (
          <p role="alert" className="text-danger">
            {state.error}
          </p>
        )}
        <ModalActions
          cancelLabel={t("cancel")}
          onCancel={close}
          pending={state.pending}
        >
          <Button
            size="sm"
            type="submit"
            variant={remove ? "danger" : "primary"}
            disabled={!state.record || state.pending}
          >
            <PendingLabel pending={state.pending} pendingText={t("saving")}>
              {remove ? actions("deleteBook") : t("save")}
            </PendingLabel>
          </Button>
        </ModalActions>
      </form>
    </EditorialModalShell>
  );
}
