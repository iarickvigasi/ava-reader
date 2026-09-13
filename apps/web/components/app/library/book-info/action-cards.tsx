"use client";

import { useTranslations } from "next-intl";

import type { LibraryBookInfo } from "@/lib/api-types";

import { ActionCard } from "./action-card";
import { DownloadOfflineCard } from "./download-offline-card";
import { FinishedDateCard } from "./finished-date-card";
import { ManageCollectionsCard } from "./manage-collections-card";
import { TrashBoldIcon } from "./trash-bold-icon";

type BookActionCardsProps = {
  collections: LibraryBookInfo["collections"];
  finishedAt: string | null;
  libraryItemId: string;
};

export function BookActionCards({
  collections,
  finishedAt,
  libraryItemId,
}: BookActionCardsProps) {
  const t = useTranslations("library.bookInfo.actionCards");
  return (
    <aside className="space-y-4">
      {/* Download for offline — tri-state action card. Title + description
          and onClick all flip based on whether the book is saved, currently
          downloading, or untouched. The card replaces the old static
          placeholder; same icon and visual treatment, just wired up. */}
      <DownloadOfflineCard libraryItemId={libraryItemId} />
      <FinishedDateCard finishedAt={finishedAt} libraryItemId={libraryItemId} />
      <ManageCollectionsCard collections={collections} libraryItemId={libraryItemId} />
      <ActionCard
        danger
        description={t("deleteBook.description")}
        icon={TrashBoldIcon}
        title={t("deleteBook.title")}
      />
    </aside>
  );
}
