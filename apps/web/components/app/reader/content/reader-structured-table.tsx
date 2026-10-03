import { useReaderMeasurement } from "./reader-measurement-context";
import type { CSSProperties } from "react";
import type { ReaderBlock } from "@/lib/api-types";
import { useReaderBlockProps } from "./block-props";
import { ReaderInlineContent } from "./reader-inline-content";
import { canonicalStyle } from "@/features/reader/canonical/style";

export function ReaderStructuredTable({
  block,
  chapterId,
  style,
}: {
  block: Extract<ReaderBlock, { kind: "table" }>;
  chapterId: string;
  style?: CSSProperties;
}) {
  const measurement = useReaderMeasurement();
  const blockProps = useReaderBlockProps();
  const rowCount = Math.max(
    ...block.cells.map((cell) => cell.row + (cell.rowSpan ?? 1)),
  );
  const rows = Array.from({ length: rowCount }, (_, row) => row);
  return (
    <table
      {...blockProps(block, chapterId)}
      data-reader-block-kind="image"
      aria-describedby={
        !measurement && block.captionId
          ? `reader-${chapterId}-${block.captionId}`
          : undefined
      }
      className="w-full table-fixed border-collapse text-[calc(1rem*var(--reader-font-scale)*var(--reader-block-scale,1))]"
      style={style}
    >
      <tbody>
        {rows.map((row) => (
          <tr key={row}>
            {block.cells
              .filter((cell) => cell.row === row)
              .sort((a, b) => a.column - b.column)
              .map((cell) => {
                const Tag = cell.headerAxis ? "th" : "td";
                return (
                  <Tag
                    key={cell.id}
                    rowSpan={cell.rowSpan}
                    colSpan={cell.columnSpan}
                    {...blockProps(
                      cell,
                      chapterId,
                      canonicalStyle(cell.presentation),
                    )}
                    scope={
                      cell.headerAxis === "row" || cell.headerAxis === "column"
                        ? cell.headerAxis === "column"
                          ? "col"
                          : "row"
                        : undefined
                    }
                    headers={
                      !measurement && cell.headerIds.length
                        ? cell.headerIds
                            .map((id) => `reader-${chapterId}-${id}`)
                            .join(" ")
                        : undefined
                    }
                    className="border-b border-line p-2 text-start align-top [overflow-wrap:anywhere]"
                  >
                    <ReaderInlineContent inlines={cell.inlines} />
                  </Tag>
                );
              })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
