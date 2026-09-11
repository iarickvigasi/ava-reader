import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { useCollectionPicker } from "@/features/library/collection-picker/use-collection-picker";
import { LibraryBoldIcon } from "../library-bold-icon";
import { CollectionRow } from "./collection-row";

export function PickerContent({ picker }: {
  picker: ReturnType<typeof useCollectionPicker>;
}) {
  const t = useTranslations("library.bookInfo.collectionPicker");
  if (picker.loading) return (
    <p role="status" className="py-8 text-center text-copy">{t("loading")}</p>
  );
  if (picker.unavailable) return (
    <div className="space-y-4 rounded-card bg-paper-strong/70 p-6 text-center">
      <p role="alert" className="text-copy">
        {t(picker.online ? "loadFailed" : "unavailableOffline")}
      </p>
      <Button size="sm" variant="soft" type="button" onClick={() => void picker.retry()}>
        {t("retry")}
      </Button>
    </div>
  );
  if (picker.collections.length === 0) return (
    <div className="rounded-card bg-paper-strong/70 px-5 py-8 text-center">
      <span aria-hidden className="mx-auto mb-4 flex size-12 items-center justify-center rounded-control bg-soft-fill text-brand-fill">
        <LibraryBoldIcon className="size-6" />
      </span>
      <h3 className="font-reader text-xl text-title">{t("emptyTitle")}</h3>
      <p className="mx-auto mt-2 max-w-xs text-base leading-6 text-copy">{t("emptyDescription")}</p>
    </div>
  );
  return (
    <div className="space-y-2">
      {picker.collections.map((collection) => (
        <CollectionRow key={collection.id} collection={collection}
          checked={picker.selectedIds.has(collection.id)} disabled={picker.pending}
          onToggle={() => picker.toggle(collection.id)} />
      ))}
    </div>
  );
}
