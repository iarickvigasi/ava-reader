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
import { ReaderNoteSemantics } from "../../content/reader-note-semantics";
import { ReaderNoteReturns } from "../../content/reader-note-returns";
import { BilingualFlowSentences } from "./bilingual-flow-sentences";

type TextTag =
  | "pre"
  | "p"
  | "blockquote"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6";

export function BilingualFlowTextBlock(props: BilingualFlowBlockProps) {
  const {
    group: { block, units },
    chapter,
    side,
  } = props;
  if (!("inlines" in block)) return null;
  const Tag: TextTag =
    block.kind === "heading"
      ? (`h${Math.max(1, Math.min(6, Math.round(block.level)))}` as TextTag)
      : block.kind === "blockquote"
        ? "blockquote"
        : block.kind === "code"
          ? "pre"
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
  const content = (
    <>
      <Tag
        {...attributes}
        data-bilingual-flow-content
        dir="auto"
        className={cn(className, resolveAlignmentClass(block))}
        style={{
          ...resolveBlockStyle(block),
          ...(block.kind === "code" ||
          block.kind === "verse" ||
          block.preserveWhitespace
            ? ({ whiteSpace: "pre-wrap", overflowWrap: "anywhere" } as const)
            : {}),
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
      {side === "source" &&
        block.kind === "note" &&
        block.returns &&
        units.at(-1)!.unit.endOffset === block.text.length && (
          <div data-bilingual-affix={units.at(-1)!.unit.id}>
            <ReaderNoteReturns blockId={block.id} returns={block.returns} />
          </div>
        )}
    </>
  );
  return block.kind === "note" ? (
    <ReaderNoteSemantics noteRole={block.noteRole}>
      {content}
    </ReaderNoteSemantics>
  ) : (
    content
  );
}
