import type { CSSProperties } from "react";
import type { ReaderListBlock } from "@/lib/api-types/reader-content";
import { ReaderInlineContent } from "./reader-inline-content";
import { LIST_CLASS } from "./reader-block-classes";
import { useReaderBlockProps } from "./block-props";
import { structuredLeafStyle } from "./structured-leaf-style";
import { resolveBlockStyle } from "./reader-block-style";

export function ReaderStructuredList({
  block,
  chapterId,
  style,
}: {
  block: ReaderListBlock;
  chapterId: string;
  style?: CSSProperties;
}) {
  const blockProps = useReaderBlockProps();
  const Tag = block.ordered ? "ol" : "ul";
  const props = block.canonical
    ? { style }
    : blockProps(block, chapterId, style);
  return (
    <Tag
      {...props}
      data-reader-block-kind={block.canonical ? undefined : "list"}
      style={{
        ...style,
        ...(block.markerStyle
          ? {
              listStyleType:
                block.markerStyle === "bullet" ? "disc" : block.markerStyle,
            }
          : {}),
      }}
      start={block.ordered ? block.start : undefined}
      className={`[--reader-list-base:1.12rem] sm:[--reader-list-base:1.28rem] ${LIST_CLASS} ${block.ordered ? "list-decimal" : "list-disc"}`}
    >
      {block.items.map((item) => (
        <li key={item.id} style={structuredLeafStyle(item, "list")}>
          <span
            {...blockProps(item, chapterId)}
            data-reader-block-kind="paragraph"
          >
            <ReaderInlineContent inlines={item.inlines} />
          </span>
          {item.children?.map((child) => (
            <ReaderStructuredList
              key={child.id}
              block={child}
              chapterId={chapterId}
              style={resolveBlockStyle(child)}
            />
          ))}
        </li>
      ))}
    </Tag>
  );
}
