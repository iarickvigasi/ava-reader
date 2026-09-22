import type { PaginatePairsInput, PaginatePairsResult } from "../types";
import { assertNonnegativeFinite } from "./measured-page-count";
import { PairPaginationState } from "./pagination-state";
import { paginateNextPair } from "./paginate-next-pair";
export { findBilingualPageForUnit } from "./find-page-for-unit";

/**
 * Packs source and translation into shared page boundaries using paragraph-flow
 * measurements when supplied, or measured row heights for the fallback path.
 *
 * Unknown translations stop the prefix. Call again after translating the single
 * nextMissingUnitId. Setting maxPages to currentPageIndex + 2 bounds demand to
 * the current page and its successor, plus at most one sentence whose translated
 * height is needed to discover the second page's end.
 */
export function paginatePairs({
  units,
  paneHeight,
  rowGap = 0,
  startUnitIndex = 0,
  maxPages = Number.POSITIVE_INFINITY,
  measureRange,
}: PaginatePairsInput): PaginatePairsResult {
  assertNonnegativeFinite(paneHeight, "paneHeight");
  if (paneHeight === 0) throw new RangeError("paneHeight must be positive");
  assertNonnegativeFinite(rowGap, "rowGap");
  if (
    !Number.isInteger(startUnitIndex) ||
    startUnitIndex < 0 ||
    startUnitIndex > units.length
  ) {
    throw new RangeError(
      "startUnitIndex must be an index between 0 and units.length",
    );
  }
  if (
    maxPages !== Number.POSITIVE_INFINITY &&
    (!Number.isInteger(maxPages) || maxPages < 0)
  ) {
    throw new RangeError("maxPages must be a nonnegative integer or Infinity");
  }

  const state = new PairPaginationState(
    units,
    paneHeight,
    startUnitIndex,
    measureRange,
  );
  while (state.index < units.length && state.pages.length < maxPages) {
    const stopped = paginateNextPair(state, { rowGap, maxPages });
    if (stopped) return stopped;
  }
  if (state.index === units.length) state.finalizePendingPage();
  return state.result();
}
