import { useId } from "react";
import { useTranslations } from "next-intl";
import type { useCollectionPicker } from "@/features/library/collection-picker/use-collection-picker";
import { ModalShell } from "../../collection/collection-actions/modal-shell";
import { PickerContent } from "./picker-content";
import { PickerFooter } from "./picker-footer";

export function CollectionPickerDialog({ picker }: {
  picker: ReturnType<typeof useCollectionPicker>;
}) {
  const titleId = useId();
  const t = useTranslations("library.bookInfo.collectionPicker");
  return (
    <ModalShell onClose={picker.close} labelledBy={titleId}>
      <form
        className="flex max-h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden rounded-modal bg-surface/95 text-ink shadow-(--shadow-card) backdrop-blur"
        onSubmit={(event) => { event.preventDefault(); void picker.save(); }}
      >
        <div className="shrink-0 px-5 pb-5 pt-6 sm:px-6">
          <h2 id={titleId} tabIndex={-1} autoFocus
            className="font-reader text-[1.75rem] leading-[1.1] text-title outline-none">
            {t("title")}
          </h2>
          <p className="mt-2 text-base text-copy">{t("description")}</p>
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain px-5 pb-5 sm:px-6">
          <PickerContent picker={picker} />
        </div>
        <PickerFooter picker={picker} />
      </form>
    </ModalShell>
  );
}
