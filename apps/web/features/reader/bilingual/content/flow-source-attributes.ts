import type { BilingualFlowUnit } from "./flow-types";

export function flowSourceAttributes(
  units: readonly BilingualFlowUnit[],
  chapterId: string,
  kind: string,
) {
  const first = units[0].unit;
  const last = units[units.length - 1].unit;
  return {
    "data-block-id": first.blockId,
    "data-chapter-id": chapterId,
    "data-reader-block-kind": kind,
    "data-reader-start-offset": first.startOffset,
    "data-reader-end-offset": last.endOffset,
  };
}
