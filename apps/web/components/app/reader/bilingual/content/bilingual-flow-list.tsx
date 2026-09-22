import type { BilingualFlowBlockProps } from "@/features/reader/bilingual/content/flow-types";
import { flowSourceAttributes } from "@/features/reader/bilingual/content/flow-source-attributes";
import { groupFlowListItems } from "@/features/reader/bilingual/content/group-flow-list-items";
import { cn } from "@/lib/cn";
import { LIST_CLASS } from "@/components/app/reader/content/reader-block-classes";
import {
  resolveAlignmentClass,
  resolveBlockStyle,
} from "@/components/app/reader/content/reader-block-style";
import { BilingualFlowSentences } from "./bilingual-flow-sentences";

export function BilingualFlowList({
  group,
  chapter,
  side,
}: BilingualFlowBlockProps) {
  const { block, units } = group;
  if (block.kind !== "list") return null;
  const Tag = block.ordered ? "ol" : "ul";
  const attributes =
    side === "source"
      ? flowSourceAttributes(units, chapter.chapterId, block.kind)
      : {};
  return (
    <Tag
      {...attributes}
      data-bilingual-flow-content
      dir="auto"
      className={cn(
        LIST_CLASS,
        block.ordered ? "list-decimal" : "list-disc",
        resolveAlignmentClass(block),
      )}
      style={resolveBlockStyle(block)}
    >
      {groupFlowListItems(block, units).map((item) => {
        const itemAttributes =
          side === "source"
            ? flowSourceAttributes(item.units, chapter.chapterId, block.kind)
            : {};
        const continued = item.units[0].unit.startOffset > item.startOffset;
        return (
          <li
            key={item.id}
            {...itemAttributes}
            value={block.ordered ? item.itemIndex + 1 : undefined}
            data-bilingual-flow-item={item.id}
            data-bilingual-flow-item-start={item.startOffset}
            style={continued ? { listStyleType: "none" } : undefined}
          >
            <BilingualFlowSentences
              units={item.units}
              block={block}
              chapter={chapter}
              side={side}
            />
          </li>
        );
      })}
    </Tag>
  );
}
