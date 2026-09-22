import {
  assertNonnegativeFinite,
  measuredPageCount,
} from "./measured-page-count";
import type { PairPaginationState } from "./pagination-state";
import type { PaginatePairsResult } from "../types";

export function paginateNextPair(
  state: PairPaginationState,
  { rowGap, maxPages }: { rowGap: number; maxPages: number },
): PaginatePairsResult | null {
  const unit = state.units[state.index];
  assertNonnegativeFinite(unit.sourceHeight, `${unit.id}.sourceHeight`);
  // Images are contained within the pane by the renderer, never fragmented.
  const sourceHeight =
    unit.kind === "image"
      ? Math.min(unit.sourceHeight, state.paneHeight)
      : unit.sourceHeight;

  // The original alone can prove that the next row cannot fit, avoiding a
  // translation request once the current-and-next-page limit has been reached.
  const sourceFlow = state.measureRange?.(
    state.pending?.unitIndexes[0] ?? state.index,
    state.index + 1,
  );
  const sourceOverflows = sourceFlow
    ? state.pending !== null && sourceFlow.sourceHeight > state.paneHeight
    : state.exceedsPendingPage(sourceHeight, rowGap);
  if (sourceOverflows) {
    state.finalizePendingPage();
    if (state.pages.length >= maxPages) return state.result();
  }
  if (unit.kind === "sentence" && unit.translationHeight === null)
    return state.result(state.index);

  const translationHeight = unit.kind === "image" ? 0 : unit.translationHeight!;
  assertNonnegativeFinite(translationHeight, `${unit.id}.translationHeight`);
  const rowHeight = Math.max(sourceHeight, translationHeight);
  let flow = state.measureRange?.(
    state.pending?.unitIndexes[0] ?? state.index,
    state.index + 1,
  );
  const flowHeight = flow
    ? Math.max(flow.sourceHeight, flow.translationHeight ?? 0)
    : null;
  if (
    flowHeight !== null
      ? state.pending !== null && flowHeight > state.paneHeight
      : state.exceedsPendingPage(rowHeight, rowGap)
  ) {
    state.finalizePendingPage();
    if (state.pages.length >= maxPages) return state.result();
    flow = state.measureRange?.(state.index, state.index + 1);
  }

  const sourcePages =
    unit.kind === "image"
      ? 1
      : measuredPageCount(unit.sourcePageCount, sourceHeight, state.paneHeight);
  const translationPages =
    unit.kind === "image"
      ? 1
      : measuredPageCount(
          unit.translationPageCount,
          translationHeight,
          state.paneHeight,
        );
  if (sourcePages === null || translationPages === null)
    return state.result(null, unit.id);

  const continuationCount = Math.max(sourcePages, translationPages);
  if (continuationCount > 1) {
    state.finalizePendingPage();
    if (state.pages.length >= maxPages) return state.result();
    state.appendContinuations(continuationCount, maxPages);
  } else {
    state.appendRow(
      rowHeight,
      rowGap,
      flow
        ? Math.max(flow.sourceHeight, flow.translationHeight ?? 0)
        : undefined,
    );
  }
  return null;
}
