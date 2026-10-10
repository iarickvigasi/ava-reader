import type { CanonicalBookV2 } from "@/lib/api-types/canonical-reader.generated";
import type { ReaderLocator } from "@/lib/api-types/reader";
import { indexCanonicalBook } from "./index-book";
import { canonicalTarget } from "./inlines";

export type ReaderSourcePage = {
  number: number;
  label: string;
  target: ReaderLocator | null;
};

export function canonicalSourcePages(
  book: CanonicalBookV2,
): ReaderSourcePage[] {
  const marked = book.addresses.filter(
    (address) => address.source_page != null,
  );
  const targets = new Map<number, ReaderLocator | null>();
  if (marked.length) {
    // The semantically validated map owns physical-page starts. A blank page
    // has no address; never substitute a later block or a legacy guess.
    for (const address of marked) {
      const page = address.source_page!;
      if (targets.has(page)) throw new Error("Duplicate canonical source page");
      const { chapterId, blockId, textOffset } = canonicalTarget(
        book,
        address.target,
      );
      targets.set(page, { chapterId, blockId, textOffset });
    }
  } else {
    const index = indexCanonicalBook(book);
    for (const chapterId of book.spine) {
      for (const blockId of index.chapters.get(chapterId)?.block_ids ?? []) {
        const evidence = index.blocks.get(blockId)?.evidence ?? [];
        for (const region of evidence) {
          if (targets.has(region.page)) continue;
          // Fixed older books have no interior page offsets. Such a page
          // cannot be opened precisely; do not claim the block start is it.
          const continuation = evidence.some(
            (prior) => prior.page < region.page,
          );
          targets.set(
            region.page,
            continuation ? null : { chapterId, blockId, textOffset: 0 },
          );
        }
      }
    }
  }
  return book.pages.map((page) => ({
    number: page.number,
    label: page.label ?? String(page.number),
    target: targets.get(page.number) ?? null,
  }));
}
