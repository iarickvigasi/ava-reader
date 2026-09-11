import { useTranslations } from "next-intl";
import { Button, ButtonLink } from "@/components/ui/button";
import { PendingLabel } from "@/components/app/shared/pending-label";
import { APP_LIBRARY_HREF } from "@/lib/app-routes";
import type { useCollectionPicker } from "@/features/library/collection-picker/use-collection-picker";

export function PickerFooter({ picker }: {
  picker: ReturnType<typeof useCollectionPicker>;
}) {
  const t = useTranslations("library.bookInfo.collectionPicker");
  const ready = !picker.loading && !picker.unavailable;
  const empty = ready && picker.collections.length === 0;
  return (
    <div className="shrink-0 space-y-3 border-t border-line/30 px-5 py-4 sm:px-6">
      {picker.error ? <p role="alert" className="text-sm text-danger">{picker.error}</p> : null}
      {ready && !empty ? (
        <div className="space-y-1 text-sm text-muted">
          <p aria-live="polite">{t("selectedCount", { count: picker.selectedCount })}</p>
          {!picker.online ? <p>{t("offlineHint")}</p> : null}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button size="sm" variant="soft" type="button" disabled={picker.pending} onClick={picker.close}>
          {t(empty || !ready ? "close" : "cancel")}
        </Button>
        {empty ? (
          <ButtonLink size="sm" href={APP_LIBRARY_HREF}>{t("goToLibrary")}</ButtonLink>
        ) : ready ? (
          <Button size="sm" type="submit" disabled={!picker.dirty || picker.pending}>
            <PendingLabel pending={picker.pending} pendingText={t("saving")}>{t("save")}</PendingLabel>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
