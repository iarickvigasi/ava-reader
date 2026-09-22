import type { BilingualFlowProps } from "@/features/reader/bilingual/content/flow-types";
import { groupFlowContent } from "@/features/reader/bilingual/content/group-flow-content";
import { BilingualFlowBlock } from "./bilingual-flow-block";

const INLINE_IMAGE_MAX_HEIGHT = 128;

/** Natural book flow; the caller owns page dimensions and overflow clipping. */
export function BilingualFlowContent({
  chapter,
  blocks,
  unitIndexes,
  side,
  pageHeight,
}: BilingualFlowProps) {
  const imageHeight = Math.min(
    INLINE_IMAGE_MAX_HEIGHT,
    pageHeight > 0 ? pageHeight : INLINE_IMAGE_MAX_HEIGHT,
  );
  const style = {
    "--bilingual-inline-image-height": `${imageHeight}px`,
  } as CSSProperties;
  return (
    <div
      style={style}
      className="space-y-5 wrap-break-word [column-fill:auto] sm:space-y-6 md:space-y-7 [&_img]:max-h-(--bilingual-inline-image-height)"
    >
      {groupFlowContent(chapter.units, blocks, unitIndexes).map((group) => (
        <div
          key={group.units[0].unit.id}
          data-bilingual-flow-block
          data-flow-block-kind={group.block.kind}
          data-flow-first-unit={group.units[0].unit.id}
          data-flow-last-unit={group.units.at(-1)!.unit.id}
        >
          <BilingualFlowBlock
            group={group}
            chapter={chapter}
            side={side}
            pageHeight={pageHeight}
          />
        </div>
      ))}
    </div>
  );
}
import type { CSSProperties } from "react";
