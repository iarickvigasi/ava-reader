import type { BilingualFlowBlockProps } from "@/features/reader/bilingual/content/flow-types";
import { flowSourceAttributes } from "@/features/reader/bilingual/content/flow-source-attributes";
import { cn } from "@/lib/cn";
import {
  BLOCKQUOTE_CLASS,
  HEADING_CLASS,
  PARAGRAPH_CLASS,
} from "@/components/app/reader/content/reader-block-classes";
import {
  resolveAlignmentClass,
  resolveBlockStyle,
} from "@/components/app/reader/content/reader-block-style";
import { BilingualFlowImage } from "./bilingual-flow-image";
import { BilingualFlowList } from "./bilingual-flow-list";
import { BilingualFlowSentences } from "./bilingual-flow-sentences";

type TextTag = "p" | "blockquote" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

export function BilingualFlowBlock(props: BilingualFlowBlockProps) {
  const {
    group: { block, units },
    chapter,
    side,
  } = props;
  if (block.kind === "image") return <BilingualFlowImage {...props} />;
  if (block.kind === "list") return <BilingualFlowList {...props} />;
  const Tag: TextTag =
    block.kind === "heading"
      ? (`h${Math.max(1, Math.min(6, Math.round(block.level)))}` as TextTag)
      : block.kind === "blockquote"
        ? "blockquote"
        : "p";
  const className =
    block.kind === "heading"
      ? HEADING_CLASS
      : block.kind === "blockquote"
        ? BLOCKQUOTE_CLASS
        : PARAGRAPH_CLASS;
  const attributes =
    side === "source"
      ? flowSourceAttributes(units, chapter.chapterId, block.kind)
      : {};
  const continuation =
    block.kind === "paragraph" && units[0].unit.startOffset > 0;
  return (
    <Tag
      {...attributes}
      data-bilingual-flow-content
      dir="auto"
      className={cn(className, resolveAlignmentClass(block))}
      style={{
        ...resolveBlockStyle(block),
        ...(continuation ? { textIndent: 0 } : {}),
      }}
    >
      <BilingualFlowSentences
        units={units}
        block={block}
        chapter={chapter}
        side={side}
      />
    </Tag>
  );
}
