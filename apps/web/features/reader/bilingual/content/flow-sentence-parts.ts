import type { BilingualChapter } from "@/lib/api-types/bilingual";
import type { ReaderBlock, ReaderInline } from "@/lib/api-types/reader";
import type { BilingualFlowUnit } from "./flow-types";
import { resolveInlineSource, sourceInlinesForUnit } from "./source-inlines";

export function flowSentenceParts(
  units: readonly BilingualFlowUnit[],
  block: ReaderBlock,
  chapter: BilingualChapter,
  side: "source" | "translation",
) {
  return units.map((entry, index) => {
    const { unit } = entry;
    if (side === "translation" && unit.kind !== "literal") {
      const text = chapter.translations[unit.id]?.trim() ?? "";
      const previous = units[index - 1]?.unit;
      const before =
        block.kind === "verse"
          ? (previous
              ? (previous.text.match(/\s*$/)?.[0] ?? "") +
                block.text.slice(previous.endOffset, unit.startOffset)
              : "") + (unit.text.match(/^\s*/)?.[0] ?? "")
          : index > 0
            ? " "
            : "";
      return {
        ...entry,
        before: [{ kind: "text", text: before }] as ReaderInline[],
        inlines: [{ kind: "text", text }] as ReaderInline[],
        missing: chapter.translations[unit.id] === undefined,
      };
    }
    const previous = units[index - 1]?.unit;
    const source =
      block.kind === "image" ? null : resolveInlineSource(block, unit.itemId);
    const sourceText =
      source?.inlines
        .map((inline) => (inline.kind === "text" ? inline.text : ""))
        .join("") ?? "";
    const gap =
      previous &&
      source &&
      previous.blockId === unit.blockId &&
      previous.itemId === unit.itemId
        ? sourceText.slice(
            previous.endOffset - source.offset,
            unit.startOffset - source.offset,
          )
        : "";
    const before = gap
      ? sourceInlinesForUnit(
          {
            ...unit,
            text: gap,
            startOffset: previous!.endOffset,
            endOffset: unit.startOffset,
          },
          block,
        )
      : [];
    return {
      ...entry,
      before,
      inlines: sourceInlinesForUnit(unit, block),
      missing: false,
    };
  });
}
