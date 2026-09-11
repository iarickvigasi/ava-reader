"use client";

import { useTranslations } from "next-intl";
import type { LibraryBookInfo } from "@/lib/api-types";
import { useManageCollections } from "@/features/library/collection-picker/use-manage-collections";
import { ActionCard } from "./action-card";
import { useBookInfoFormatters } from "./formatters";
import { LibraryBoldIcon } from "./library-bold-icon";
import { CollectionPickerModal } from "./collection-picker/collection-picker-modal";

export function ManageCollectionsCard({ libraryItemId, collections }: {
  libraryItemId: string;
  collections: LibraryBookInfo["collections"];
}) {
  const t = useTranslations("library.bookInfo.actionCards");
  const fmt = useBookInfoFormatters();
  const picker = useManageCollections(libraryItemId);
  const count = collections.filter(({ kind }) => kind === "CUSTOM").length;
  return (
    <div>
      <ActionCard description={fmt.formatCollectionLabel(count)} icon={LibraryBoldIcon}
        title={t("manageCollections.title")} onClick={picker.show} />
      {picker.error ? <p role="alert" className="mt-2 text-sm text-danger">{picker.error}</p> : null}
      {picker.open ? <CollectionPickerModal libraryItemId={libraryItemId}
        memberships={collections} onClose={picker.close} /> : null}
    </div>
  );
}
