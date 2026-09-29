import type { PageMetrics } from "@/features/reader/measurement/geometry";
import type { CSSProperties } from "react";

export const BILINGUAL_CONTINUATION_GAP = 48;

export function bilingualColumnStyle(
  width: number,
  height: number,
  page = 0,
): CSSProperties {
  return {
    width,
    height,
    columnWidth: width,
    columnCount: "auto",
    columnGap: BILINGUAL_CONTINUATION_GAP,
    columnFill: "auto",
    position: "relative",
    left: -page * (width + BILINGUAL_CONTINUATION_GAP),
    overflowWrap: "anywhere",
    orphans: 1,
    widows: 1,
    direction: "ltr",
  };
}

export function applyBilingualColumns(
  element: HTMLElement,
  width: number,
  height: number,
) {
  const style = bilingualColumnStyle(width, height);
  Object.assign(element.style, {
    ...style,
    width: `${width}px`,
    height: `${height}px`,
    columnWidth: `${width}px`,
    columnGap: `${BILINGUAL_CONTINUATION_GAP}px`,
    left: "0px",
  });
}

export function bilingualColumnMetrics(
  element: HTMLElement,
  width: number,
): PageMetrics {
  return {
    columnCount: 1,
    pageBoxLeft: element.getBoundingClientRect().left,
    pageWidth: width,
    pageSpan: width + BILINGUAL_CONTINUATION_GAP,
  };
}
