import { collectTocChapterEntries } from "@/features/reader/toc";
import type { ReaderBookPayload, ReaderTocNode } from "@/lib/api-types/reader";
import type { AvaReaderDB, BookRow } from "../../../db";

// Narrow the temporary refresh to excerpt-shaped labels with an opening heading.
// The server remains authoritative; this never generates a title in the browser.
export async function findHeadingExcerpts(db: AvaReaderDB, book: BookRow) {
  const candidates = [
    ...collectTocChapterEntries((book.toc ?? []) as ReaderTocNode[]),
  ].filter(([, entry]) => {
    if (entry.spineIndex === null) return false;
    const prefix = `${entry.spineIndex + 1}.`;
    return (
      entry.label === prefix ||
      (entry.label.startsWith(`${prefix} `) && entry.label.endsWith("…"))
    );
  });
  const chapters = await db.bookChapters.bulkGet(
    candidates.map(([id]) => [book.libraryItemId, id]),
  );
  const bookTitle = (book.metadata as ReaderBookPayload).title;
  const labels = new Map<string, string>();
  candidates.forEach(([id, entry], index) => {
    const opening = chapters[index]?.blocks.find(
      (block) => block.kind !== "image" && block.text.trim(),
    );
    if (
      opening?.kind === "heading" &&
      normalize(opening.text) !== normalize(bookTitle)
    )
      labels.set(id, entry.label);
  });
  return labels;
}

function normalize(text: string) {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}
