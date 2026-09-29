import type { CSSProperties } from "react";
import type { ReaderBlockBase } from "@/lib/api-types/reader-content";

export function blockProps(
  block: ReaderBlockBase,
  chapterId: string,
  style?: CSSProperties,
) {
  return {
    "data-block-id": block.id,
    "data-chapter-id": chapterId,
    "data-reader-block": "true" as const,
    id: block.canonical
      ? `reader-${chapterId}-${block.id}`
      : (block.anchorId ?? undefined),
    tabIndex: -1,
    style,
  };
}
