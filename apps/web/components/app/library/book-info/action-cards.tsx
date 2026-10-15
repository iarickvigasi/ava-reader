"use client";

import type { LibraryBookInfo } from "@/lib/api-types";

import { DeleteBookCard } from "./delete-book-card";
import { DownloadOfflineCard } from "./download-offline-card";
import { FinishedDateCard } from "./finished-date-card";
import { ManageCollectionsCard } from "./manage-collections-card";

type BookActionCardsProps = {
  collections: LibraryBookInfo["collections"];
  finishedAt: string | null;
  libraryItemId: string;
  pdfImport?: LibraryBookInfo["pdfImport"];
  epubImport?: LibraryBookInfo["epubImport"];
};

export function BookActionCards({
  collections,
  finishedAt,
  libraryItemId,
  pdfImport,
  epubImport,
}: BookActionCardsProps) {
  return (
    <aside className="space-y-4">
      {/* Download for offline — tri-state action card. Title + description
          and onClick all flip based on whether the book is saved, currently
          downloading, or untouched. The card replaces the old static
          placeholder; same icon and visual treatment, just wired up. */}
      <DownloadOfflineCard
        libraryItemId={libraryItemId}
        pdfImport={pdfImport}
        epubImport={epubImport}
      />
      <FinishedDateCard finishedAt={finishedAt} libraryItemId={libraryItemId} />
      <ManageCollectionsCard
        collections={collections}
        libraryItemId={libraryItemId}
      />
      <DeleteBookCard libraryItemId={libraryItemId} />
    </aside>
  );
}
