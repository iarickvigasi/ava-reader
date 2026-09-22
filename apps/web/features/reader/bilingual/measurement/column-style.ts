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
