import type {
  CanonicalBookV2,
  TextValue,
  InternalTarget,
  NoteTarget,
  Style,
} from "@/lib/api-types/canonical-reader.generated";
import type {
  ReaderInline,
  ReaderLinkTarget,
} from "@/lib/api-types/reader-content";
import { indexCanonicalBook } from "./index-book";

export function canonicalTarget(
  book: CanonicalBookV2,
  target: InternalTarget | NoteTarget,
): ReaderLinkTarget {
  const index = indexCanonicalBook(book);
  const block = index.blocks.get(target.block_id);
  const cell = index.cells.get(target.block_id);
  const content = block && "content" in block ? block.content : cell?.content;
  const textOffset =
    content?.codepoint_utf16[target.offset] ??
    (target.offset === 0 ? 0 : undefined);
  if (textOffset === undefined) throw new Error("Invalid canonical address");
  return {
    chapterId: target.chapter_id,
    blockId: target.block_id,
    textOffset,
    note: target.kind === "note",
  };
}

export function canonicalInlines(
  book: CanonicalBookV2,
  content: TextValue,
): ReaderInline[] {
  const spans = content.spans ?? [];
  const edges = [
    ...new Set([
      0,
      content.codepoint_utf16.length - 1,
      ...spans.flatMap((s) => [s.start, s.end]),
    ]),
  ].sort((a, b) => a - b);
  return edges.slice(0, -1).map((start, index) => {
    const end = edges[index + 1];
    const active = spans
      .filter((s) => s.start <= start && s.end >= end)
      .sort((a, b) => a.start - b.start || b.end - a.end);
    const presentation = active.reduce<Style>(
      (style, span) => {
        const selected = span.style_id
          ? indexCanonicalBook(book).styles.get(span.style_id)
          : undefined;
        return {
          ...style,
          ...Object.fromEntries(
            Object.entries(selected ?? {}).filter(
              ([, value]) => value !== null && value !== undefined,
            ),
          ),
        };
      },
      { id: "inline" },
    );
    const linked = active.findLast((span) => span.link);
    return {
      kind: "text",
      text: content.text.slice(
        content.codepoint_utf16[start],
        content.codepoint_utf16[end],
      ),
      presentation,
      sourceOffset: content.codepoint_utf16[linked?.start ?? start],
      spanId: linked?.id,
      ...(linked?.link?.kind === "external"
        ? { href: linked.link.url }
        : linked?.link
          ? { target: canonicalTarget(book, linked.link) }
          : {}),
    };
  });
}
