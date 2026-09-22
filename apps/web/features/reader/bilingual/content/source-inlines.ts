import type { BilingualUnit } from "@/lib/api-types/bilingual";
import type { ReaderBlock, ReaderInline } from "@/lib/api-types/reader";

/** Slice verbatim UTF-16 text, retaining run formatting and zero-width images. */
export function sourceInlinesForUnit(
  unit: BilingualUnit,
  block?: ReaderBlock,
): ReaderInline[] {
  const fallback: ReaderInline[] = [{ kind: "text", text: unit.text }];
  if (!block || block.id !== unit.blockId || block.kind === "image")
    return fallback;
  const source = resolveInlineSource(block, unit.itemId);
  if (!source) return fallback;
  const start = unit.startOffset - source.offset;
  const end = unit.endOffset - source.offset;
  const text = inlineText(source.inlines);
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end < start ||
    end > text.length ||
    text.slice(start, end) !== unit.text
  )
    return fallback;

  let offset = 0;
  return source.inlines.flatMap((inline): ReaderInline[] => {
    if (inline.kind === "image") {
      // Boundary images belong to the following sentence; trailing images stay
      // with the final sentence. Neither alt text nor the image consumes offsets.
      const inside = offset >= start && offset < end;
      const trailing = offset === end && end === text.length;
      return inside || trailing ? [inline] : [];
    }
    const sliceStart = Math.max(0, start - offset);
    const sliceEnd = Math.min(inline.text.length, end - offset);
    offset += inline.text.length;
    return sliceStart < sliceEnd
      ? [{ ...inline, text: inline.text.slice(sliceStart, sliceEnd) }]
      : [];
  });
}

export function resolveInlineSource(
  block: Exclude<ReaderBlock, { kind: "image" }>,
  itemId?: string,
) {
  if (block.kind !== "list")
    return { inlines: block.inlines, offset: 0, itemIndex: null };
  let offset = 0;
  for (let itemIndex = 0; itemIndex < block.items.length; itemIndex += 1) {
    const item = block.items[itemIndex];
    if (item.id === itemId) return { inlines: item.inlines, offset, itemIndex };
    // DOM locator offsets concatenate list text nodes without search-text newlines.
    offset += inlineText(item.inlines).length;
  }
  return null;
}

function inlineText(inlines: readonly ReaderInline[]) {
  return inlines
    .map((inline) => (inline.kind === "text" ? inline.text : ""))
    .join("");
}
