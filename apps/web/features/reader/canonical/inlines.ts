import type {
  CanonicalBookV2,
  TextValue,
  InternalTarget,
  NoteTarget,
} from "@/lib/api-types/canonical-reader.generated";
import type {
  ReaderInline,
  ReaderLinkTarget,
} from "@/lib/api-types/reader-content";
import { indexCanonicalBook } from "./index-book";
import { inlineIntervals } from "./inline-sweep";
import { inlineViewRuns, type InlineViewGroup } from "./inline-view-runs";
import {
  inlineViewPresentation,
  type InlineParent,
} from "./inline-view-presentation";

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
  parent?: InlineParent,
): ReaderInline[] {
  const viewPresentation = inlineViewPresentation(parent);
  const groups: InlineViewGroup[] = [];
  for (const { start, end, presentation, linked } of inlineIntervals(
    content,
    indexCanonicalBook(book).styles,
  )) {
    const { presentation: view, key } = viewPresentation(
      presentation,
      !!linked,
    );
    const text = content.text.slice(
      content.codepoint_utf16[start],
      content.codepoint_utf16[end],
    );
    const prior = groups.at(-1);
    // Repeated horizontal inline margins are separate layout effects.
    const coalescible = !linked && !view.block_indent_em;
    // Only view runs without semantic callers can merge. Language is constant
    // within TextValue; all source UTF16 positions remain in canonicalText.
    if (parent && coalescible && prior?.coalescible && prior.key === key) {
      prior.parts.push(text);
      continue;
    }
    groups.push({
      key,
      coalescible,
      parts: [text],
      inline: {
        kind: "text",
        text: "",
        presentation: { ...view },
        ...(content.language ? { language: content.language } : {}),
        sourceOffset: content.codepoint_utf16[linked?.start ?? start],
        spanId: linked?.id,
        ...(linked?.link?.kind === "external"
          ? { href: linked.link.url }
          : linked?.link
            ? { target: canonicalTarget(book, linked.link) }
            : {}),
      },
    });
  }
  return inlineViewRuns(groups);
}
