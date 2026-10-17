import type { BilingualFlowBlockProps } from "@/features/reader/bilingual/content/flow-types";
import { BilingualFlowTable } from "./bilingual-flow-table";
import { BilingualStructuredList } from "./bilingual-structured-list";
import { BilingualFlowImage } from "./bilingual-flow-image";
import { BilingualFlowList } from "./bilingual-flow-list";
import { BilingualFlowSeparator } from "./bilingual-flow-separator";
import { BilingualFlowTextBlock } from "./bilingual-flow-text-block";

export function BilingualFlowBlock(props: BilingualFlowBlockProps) {
  const block = props.group.block;
  if (block.kind === "image") return <BilingualFlowImage {...props} />;
  if (block.kind === "table") return <BilingualFlowTable {...props} />;
  if (block.kind === "separator") return <BilingualFlowSeparator {...props} />;
  if (block.kind === "list")
    return block.canonical ||
      block.items.some((item) => item.children?.length) ? (
      <BilingualStructuredList {...props} />
    ) : (
      <BilingualFlowList {...props} />
    );
  return <BilingualFlowTextBlock {...props} />;
}
