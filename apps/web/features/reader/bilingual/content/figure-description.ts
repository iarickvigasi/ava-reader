import type { BilingualChapter } from "@/lib/api-types/bilingual";
import type { ReaderBlock } from "@/lib/api-types/reader";

/** Keep the complete source description until its translation is complete. */
export function figureDescription(
  descriptions: readonly ReaderBlock[] | undefined,
  chapter: BilingualChapter,
  side: "source" | "translation",
) {
  return (descriptions ?? [])
    .map((block) => {
      if (side === "source") return block.text;
      const units = chapter.units.filter((unit) => unit.blockId === block.id);
      const complete =
        units.length > 0 &&
        units[0].startOffset === 0 &&
        units.at(-1)!.endOffset === block.text.length &&
        units.every(
          (unit, index) =>
            (index === 0 || units[index - 1].endOffset === unit.startOffset) &&
            !!chapter.translations[unit.id]?.trim(),
        );
      return complete
        ? units.map((unit) => chapter.translations[unit.id].trim()).join(" ")
        : block.text;
    })
    .filter(Boolean)
    .join(" ");
}
