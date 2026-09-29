import { useId } from "react";
import { figureDescription } from "@/features/reader/bilingual/content/figure-description";
import type { BilingualFlowBlockProps } from "@/features/reader/bilingual/content/flow-types";
import { flowSourceAttributes } from "@/features/reader/bilingual/content/flow-source-attributes";

export function BilingualFlowImage({
  group,
  chapter,
  side,
  pageHeight,
}: BilingualFlowBlockProps) {
  const descriptionId = useId();
  const { block, units } = group;
  const description = figureDescription(group.descriptions, chapter, side);
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
      aria-describedby={description ? descriptionId : undefined}
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
      {description && (
        <figcaption
          data-bilingual-figure-description
          id={descriptionId}
          className="sr-only"
        >
          {description}
        </figcaption>
      )}
    </figure>
  );
}
