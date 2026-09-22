import type { BilingualFlowBlockProps } from "@/features/reader/bilingual/content/flow-types";
import { flowSourceAttributes } from "@/features/reader/bilingual/content/flow-source-attributes";

export function BilingualFlowImage({
  group,
  chapter,
  side,
  pageHeight,
}: BilingualFlowBlockProps) {
  const { block, units } = group;
  if (block.kind !== "image") return null;
  const attributes =
    side === "source"
      ? {
          ...flowSourceAttributes(units, chapter.chapterId, block.kind),
          "data-reader-block": "true",
        }
      : {};
  return (
    <figure
      {...attributes}
      data-bilingual-flow-content
      data-bilingual-unit-id={units[0].unit.id}
      data-bilingual-unit-index={units[0].index}
      className="break-inside-avoid-column space-y-3"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt={block.alt ?? ""}
        src={block.src}
        className="w-full rounded-card object-contain"
        style={{ maxHeight: pageHeight > 0 ? pageHeight : undefined }}
      />
    </figure>
  );
}
