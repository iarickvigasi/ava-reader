import type { CanonicalBookV2 } from "@/lib/api-types/canonical-reader.generated";
import type { ReaderLocator } from "@/lib/api-types/reader";
import { indexCanonicalBook } from "./index-book";

export type ReaderSourcePage = {
  number: number;
  label: string;
  target: ReaderLocator | null;
};

// Matches the exported EPUB page-list: the first canonical block associated
// with a physical source page. A joined paragraph has no intra-text page
// boundary in this contract; do not invent an offset or a reader screen number.
export function canonicalSourcePages(
  book: CanonicalBookV2,
): ReaderSourcePage[] {
  const index = indexCanonicalBook(book);
  const targets = new Map<number, ReaderLocator>();
  for (const chapterId of book.spine) {
    for (const blockId of index.chapters.get(chapterId)?.block_ids ?? []) {
      const block = index.blocks.get(blockId);
      for (const evidence of block?.evidence ?? []) {
        if (!targets.has(evidence.page))
          targets.set(evidence.page, { chapterId, blockId, textOffset: 0 });
      }
    }
  }
  return book.pages.map((page) => ({
    number: page.number,
    label: page.label ?? String(page.number),
    target: targets.get(page.number) ?? null,
  }));
}
