/**
 * Sticky edge restore intents (a chapter's start/end, e.g. after swiping across
 * a chapter boundary) pin the reader to that edge across relayouts. Once the
 * reader pages away from the edge, the pin must release — otherwise a later
 * re-measurement (e.g. a mobile address-bar viewport change) snaps them back to
 * the chapter edge, the "swiping jumps to the first page" bug.
 *
 * Returns whether the pin should remain active for the next pagination decision.
 */
export function shouldKeepStickyRestorePinned(input: {
  currentPageIndex: number;
  isStickyRestorePinned: boolean;
  // Page the last restore placed the reader on, or null before the first
  // restore of this chapter/intent has been applied.
  lastAppliedRestorePageIndex: number | null;
}): boolean {
  if (!input.isStickyRestorePinned) {
    return false;
  }

  const hasPagedAwayFromRestore =
    input.lastAppliedRestorePageIndex !== null &&
    input.currentPageIndex !== input.lastAppliedRestorePageIndex;

  return !hasPagedAwayFromRestore;
}
