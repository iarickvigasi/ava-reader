import { useReaderMeasurement } from "./reader-measurement-context";
import type { CSSProperties } from "react";
import type { ReaderBlock } from "@/lib/api-types";
import { useReaderBlockProps } from "./block-props";

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
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={block.src}
        alt={block.alt ?? ""}
        width={block.width}
        height={block.height}
        className={
          block.canonical
            ? "mx-auto max-w-full object-contain"
            : "w-full rounded-card object-contain"
        }
        style={{
          maxHeight:
            pageHeight > 0 ? Math.max(100, pageHeight - 100) : undefined,
        }}
      />
    </figure>
  );
}
