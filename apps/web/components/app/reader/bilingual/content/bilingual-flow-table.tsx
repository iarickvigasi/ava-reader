import { useId } from "react";
import type { BilingualFlowBlockProps } from "@/features/reader/bilingual/content/flow-types";
import { resolveBlockStyle } from "../../content/reader-block-style";
import { structuredLeafStyle } from "../../content/structured-leaf-style";
import { ReaderInlineContent } from "../../content/reader-inline-content";
import { BilingualFlowSentences } from "./bilingual-flow-sentences";
export function BilingualFlowTable(props: BilingualFlowBlockProps) {
  const prefix = useId();
  const block = props.group.block;
  if (block.kind !== "table") return null;
  const rowCount = Math.max(
    ...block.cells.map((cell) => cell.row + (cell.rowSpan ?? 1)),
  );
  const rows = Array.from({ length: rowCount }, (_, row) => row);
  return (
    <table
      data-bilingual-table={block.id}
      data-bilingual-flow-content
      className="w-full table-fixed border-collapse text-[calc(1rem*var(--reader-font-scale)*var(--reader-block-scale,1))]"
      style={resolveBlockStyle(block)}
    >
      <tbody>
        {rows.map((row) => (
          <tr key={row}>
            {block.cells
              .filter((cell) => cell.row === row)
              .sort((a, b) => a.column - b.column)
              .map((cell) => {
                const units = props.group.units.filter(
                  ({ unit }) => unit.blockId === cell.id,
                );
                const Tag = cell.headerAxis ? "th" : "td";
                return (
                  <Tag
                    key={cell.id}
                    rowSpan={cell.rowSpan}
                    colSpan={cell.columnSpan}
                    id={`${prefix}-${cell.id}`}
                    data-bilingual-cell={cell.id}
                    scope={
                      cell.headerAxis === "column"
                        ? "col"
                        : cell.headerAxis === "row"
                          ? "row"
                          : undefined
                    }
                    headers={
                      cell.headerIds.map((id) => `${prefix}-${id}`).join(" ") ||
                      undefined
                    }
                    style={structuredLeafStyle(cell, "table")}
                    className="border-b border-line p-2 align-top [overflow-wrap:anywhere]"
                  >
                    {cell.headerAxis && (
                      <span
                        data-bilingual-header-context
                        data-reader-ignore
                        aria-hidden={units.length ? true : undefined}
                        hidden={!!units.length}
                      >
                        <ReaderInlineContent inlines={cell.inlines} />
                      </span>
                    )}
                    <BilingualFlowSentences
                      {...props}
                      block={{ ...cell, kind: "paragraph" }}
                      units={units}
                    />
                  </Tag>
                );
              })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
