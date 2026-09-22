import type { BilingualUnit } from "@/lib/api-types/bilingual";
import type { BilingualPage, MeasuredBilingualUnit } from "../types";
import { findBilingualPageForUnit } from "../pagination/find-page-for-unit";

export type BilingualPosition = {
  key: string;
  restoreKey: string | null;
  unitIndex: number;
  continuation: number;
  layoutKey: string;
  offset: number;
  edge: "start" | "end" | null;
};

export function resolveBilingualPageIndex(input: {
  pages: readonly BilingualPage[];
  units: readonly BilingualUnit[];
  position: BilingualPosition;
  layoutKey: string;
  resolveContinuation?: (unitIndex: number, offset: number) => number;
}): number {
  const { pages, units, position, layoutKey, resolveContinuation } = input;
  if (position.edge === "end") return Math.max(0, pages.length - 1);
  if (position.edge === "start") return 0;
  // A translation-only continuation has no source character to remeasure.
  // Keep its continuation and clamp it to the new final page if it disappeared.
  const sourceEnded =
    position.offset >= (units[position.unitIndex]?.endOffset ?? Infinity);
  const continuation =
    position.layoutKey === layoutKey || sourceEnded
      ? position.continuation
      : (resolveContinuation?.(position.unitIndex, position.offset) ?? 0);
  return findBilingualPageForUnit(pages, position.unitIndex, continuation) ?? 0;
}

export function positionForBilingualPage(input: {
  previous: BilingualPosition;
  page: BilingualPage;
  units: readonly BilingualUnit[];
  measured: readonly MeasuredBilingualUnit[];
  layoutKey: string;
  offset?: number;
  keepEdge?: boolean;
}): BilingualPosition {
  const { previous, page, units, measured, layoutKey } = input;
  const unitIndex = page.unitIndexes[0];
  const unit = units[unitIndex];
  const continuation = page.continuationIndex ?? 0;
  const sourceEnded =
    continuation >= (measured[unitIndex]?.sourcePageCount ?? 1);
  const offset = sourceEnded
    ? (unit?.endOffset ?? 0)
    : Math.max(
        unit?.startOffset ?? 0,
        Math.min(
          input.offset ?? unit?.startOffset ?? 0,
          Math.max(unit?.startOffset ?? 0, (unit?.endOffset ?? 0) - 1),
        ),
      );
  const edge = input.keepEdge ? previous.edge : null;
  if (
    previous.unitIndex === unitIndex &&
    previous.continuation === continuation &&
    previous.layoutKey === layoutKey &&
    previous.offset === offset &&
    previous.edge === edge
  )
    return previous;
  return { ...previous, unitIndex, continuation, layoutKey, offset, edge };
}
