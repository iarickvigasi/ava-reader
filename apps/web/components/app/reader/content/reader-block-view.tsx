import type { ReaderBlock } from "@/lib/api-types";
import { ReaderTextBlockView } from "./reader-text-block";
import { ReaderStructuredList } from "./reader-structured-list";
import { ReaderStructuredTable } from "./reader-structured-table";
import { ReaderFigure } from "./reader-figure";
import { blockProps } from "./block-props";
import { resolveBlockStyle } from "./reader-block-style";

export function ReaderBlockView(props: {
  block: ReaderBlock;
  chapterId: string;
  pageHeight: number;
  forceColumnBreakBefore?: boolean;
}) {
  const { block, chapterId, forceColumnBreakBefore } = props;
  const style = {
    ...resolveBlockStyle(block),
    ...(forceColumnBreakBefore ? { breakBefore: "column" as const } : {}),
  };
  if (block.kind === "list")
    return (
      <ReaderStructuredList block={block} chapterId={chapterId} style={style} />
    );
  if (block.kind === "table")
    return (
      <ReaderStructuredTable
        block={block}
        chapterId={chapterId}
        style={style}
      />
    );
  if (block.kind === "image")
    return <ReaderFigure {...props} block={block} style={style} />;
  if (block.kind === "separator")
    return (
      <hr
        {...blockProps(block, chapterId, style)}
        className="my-4 border-line"
      />
    );
  return (
    <ReaderTextBlockView block={block} chapterId={chapterId} style={style} />
  );
}
