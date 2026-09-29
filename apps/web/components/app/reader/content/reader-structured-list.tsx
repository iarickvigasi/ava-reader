import type { CSSProperties } from "react";
import type { ReaderListBlock } from "@/lib/api-types/reader-content";
import { ReaderInlineContent } from "./reader-inline-content";
import { LIST_CLASS } from "./reader-block-classes";
import { useReaderBlockProps } from "./block-props";
import { canonicalStyle } from "@/features/reader/canonical/style";

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
      className={`${LIST_CLASS} ${block.ordered ? "list-decimal" : "list-disc"}`}
    >
      {block.items.map((item) => (
        <li key={item.id} style={canonicalStyle(item.presentation)}>
          <span {...(block.canonical ? blockProps(item, chapterId) : {})}>
            <ReaderInlineContent inlines={item.inlines} />
          </span>
          {item.children?.map((child) => (
            <ReaderStructuredList
              key={child.id}
              block={child}
              chapterId={chapterId}
            />
          ))}
        </li>
      ))}
    </Tag>
  );
}
