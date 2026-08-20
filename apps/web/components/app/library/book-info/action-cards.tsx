"use client";

import { useTranslations } from "next-intl";

import type { LibraryBookInfo } from "@/lib/api-types";

import { ActionCard } from "./action-card";
import { CheckBoldIcon } from "./check-bold-icon";
import { DownloadOfflineCard } from "./download-offline-card";
import { useBookInfoFormatters } from "./formatters";
import { LibraryBoldIcon } from "./library-bold-icon";
import { TrashBoldIcon } from "./trash-bold-icon";

type BookActionCardsProps = {
  collections: LibraryBookInfo["collections"];
  libraryItemId: string;
};

export function BookActionCards({
  collections,
  libraryItemId,
}: BookActionCardsProps) {
  const t = useTranslations("library.bookInfo.actionCards");
  const fmt = useBookInfoFormatters();
  return (
    <aside className="space-y-4">
      {/* Download for offline — tri-state action card. Title + description
          and onClick all flip based on whether the book is saved, currently
          downloading, or untouched. The card replaces the old static
          placeholder; same icon and visual treatment, just wired up. */}
      <DownloadOfflineCard libraryItemId={libraryItemId} />
      <ActionCard
        description={t("markAsFinished.description")}
        icon={CheckBoldIcon}
        title={t("markAsFinished.title")}
      />
      <ActionCard
        description={fmt.formatCollectionLabel(collections.length)}
        icon={LibraryBoldIcon}
        title={t("manageCollections.title")}
      />
      <ActionCard
        danger
        description={t("deleteBook.description")}
        icon={TrashBoldIcon}
        title={t("deleteBook.title")}
      />
    </aside>
  );
}
