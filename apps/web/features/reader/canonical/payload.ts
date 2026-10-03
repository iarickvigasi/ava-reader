import type {
  ReaderStatusPayload,
  ReaderTocNode,
} from "@/lib/api-types/reader";
import { canonicalChapters } from "./chapters";
import { canonicalTarget } from "./inlines";

export function canonicalPayload(
  payload: ReaderStatusPayload,
): ReaderStatusPayload {
  if (payload.status !== "READY" || !payload.readerPackage) return payload;
  const pkg = payload.readerPackage;
  if (pkg.schema_version !== "ava-reader-3" || pkg.version !== 3)
    throw new Error("Unsupported reader schema");
  const book = pkg.book;
  const nodes = new Map(
    book.toc.map((entry) => {
      const target = canonicalTarget(book, entry.target);
      return [
        entry.id,
        {
          id: entry.id,
          label: entry.label,
          children: [],
          chapterId: target.chapterId,
          blockId: target.blockId,
          textOffset: target.textOffset,
          anchorId: target.blockId,
          href: null,
          spineIndex: book.spine.indexOf(target.chapterId),
        } satisfies ReaderTocNode,
      ];
    }),
  );
  const toc: ReaderTocNode[] = [];
  for (const entry of book.toc) {
    const node = nodes.get(entry.id)!;
    if (entry.parent_id)
      (nodes.get(entry.parent_id) as ReaderTocNode).children.push(node);
    else toc.push(node);
  }
  const activeIndex = book.spine.indexOf(payload.activeChapterId);
  const window = book.spine.slice(
    Math.max(0, activeIndex - 1),
    activeIndex + 2,
  );
  const chapters = canonicalChapters(book, payload.resourceUrls ?? {}, window);
  if (!book.spine.includes(payload.activeChapterId))
    throw new Error("Missing requested chapter");
  return { ...payload, chapters, toc };
}
