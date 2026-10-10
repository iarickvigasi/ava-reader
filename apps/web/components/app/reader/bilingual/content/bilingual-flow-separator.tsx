import type { BilingualFlowBlockProps } from "@/features/reader/bilingual/content/flow-types";
import { resolveBlockStyle } from "../../content/reader-block-style";
import { flowSourceAttributes } from "@/features/reader/bilingual/content/flow-source-attributes";

export function BilingualFlowSeparator({
  group: { block, units },
  chapter,
  side,
}: BilingualFlowBlockProps) {
  return (
    <span
      {...(side === "source"
        ? flowSourceAttributes(units, chapter.chapterId, block.kind)
        : {})}
      data-reader-block={side === "source" ? "true" : undefined}
      data-bilingual-unit-id={units[0].unit.id}
      data-bilingual-unit-index={units[0].index}
    >
      <hr className="border-line" style={resolveBlockStyle(block)} />
    </span>
  );
}
