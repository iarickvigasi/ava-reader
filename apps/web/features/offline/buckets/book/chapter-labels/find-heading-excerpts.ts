import { hasRepairableOpening } from "./has-repairable-opening";
import { collectTocChapterEntries } from "@/features/reader/toc";
import type { ReaderBookPayload, ReaderTocNode } from "@/lib/api-types/reader";
import type { AvaReaderDB, BookRow } from "../../../db";

// Identify repair candidates only; the server supplies canonical labels.
export async function findHeadingExcerpts(db: AvaReaderDB, book: BookRow) {
  const candidates = [
    ...collectTocChapterEntries((book.toc ?? []) as ReaderTocNode[]),
  ];
  const chapters = await db.bookChapters.bulkGet(
    candidates.map(([id]) => [book.libraryItemId, id]),
  );
  const bookTitle = (book.metadata as ReaderBookPayload).title;
  const labels = new Map<string, string>();
  candidates.forEach(([id, entry], index) => {
    const blocks = chapters[index]?.blocks;
    if (blocks && hasRepairableOpening(blocks, entry, bookTitle))
      labels.set(id, entry.label);
  });
  return labels;
}
