import type {
  CanonicalBookV2,
  ListGroup,
} from "@/lib/api-types/canonical-reader.generated";
import type { ReaderChapterPayload } from "@/lib/api-types/reader";
import type {
  ReaderBlock,
  ReaderListBlock,
} from "@/lib/api-types/reader-content";
import { canonicalBlock } from "./blocks";
import { indexCanonicalBook } from "./index-book";

export function canonicalChapters(
  book: CanonicalBookV2,
  urls: Record<string, string>,
  window?: string[],
): ReaderChapterPayload[] {
  const lookup = indexCanonicalBook(book);
  const list = (group: ListGroup): ReaderListBlock => ({
    id: group.id,
    text: "",
    kind: "list",
    ordered: group.ordered,
    markerStyle: group.marker_style,
    start: group.start ?? undefined,
    canonical: true,
    items: group.item_ids.map((id) => {
      const block = canonicalBlock(book, id, urls);
      if (!("inlines" in block)) throw new Error("Invalid list item");
      return {
        ...block,
        inlines: block.inlines,
        children: (lookup.childLists.get(id) ?? []).map(list),
      };
    }),
  });
  return book.spine.flatMap((id, index) => {
    if (window && !window.includes(id)) return [];
    const chapter = lookup.chapters.get(id);
    if (!chapter) throw new Error("Missing canonical chapter");
    const blocks = chapter.block_ids.flatMap((blockId): ReaderBlock[] => {
      const group = lookup.itemLists.get(blockId);
      return group
        ? !group.parent_item_id && group.item_ids[0] === blockId
          ? [list(group)]
          : []
        : [canonicalBlock(book, blockId, urls)];
    });
    return {
      chapterId: id,
      blocks,
      href: chapter.resource_paths[0],
      label: chapter.title,
      title: chapter.title,
      spineIndex: index,
      previousChapterId: book.spine[index - 1] ?? null,
      nextChapterId: book.spine[index + 1] ?? null,
    };
  });
}
