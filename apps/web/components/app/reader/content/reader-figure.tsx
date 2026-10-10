import { useReaderMeasurement } from "./reader-measurement-context";
import type { CSSProperties } from "react";
import type { ReaderBlock } from "@/lib/api-types";
import { useReaderBlockProps } from "./block-props";
import { ReaderImageContent } from "./reader-image-content";

export function ReaderFigure({
  block,
  chapterId,
  pageHeight,
  style,
}: {
  block: Extract<ReaderBlock, { kind: "image" }>;
  chapterId: string;
  pageHeight: number;
  style?: CSSProperties;
}) {
  const measurement = useReaderMeasurement();
  const blockProps = useReaderBlockProps();
  const description = [block.captionId, block.creditId]
    .filter(Boolean)
    .map((id) => `reader-${chapterId}-${id}`)
    .join(" ");
  return (
    <figure
      {...blockProps(block, chapterId, style)}
      data-reader-block-kind="image"
      aria-describedby={measurement ? undefined : description || undefined}
      className="break-inside-avoid-column"
    >
      <ReaderImageContent
        block={block}
        maxHeight={pageHeight > 0 ? Math.max(100, pageHeight - 100) : undefined}
      />
    </figure>
  );
}
