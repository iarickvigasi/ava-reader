// How long after a reader touchstart a selectionchange/contextmenu still counts
// as "driven by that touch". Covers the gap between the gesture finishing and
// the browser settling the selection (and firing its native callout).
export const TOUCH_RECENCY_MS = 2_500;

// Settle delay for touch-origin checks. Gives the browser time to finish its
// own selection update (and lets a canceled long-press take over) before we
// read window.getSelection().
export const TOUCH_SETTLE_MS = 80;

// Mouse and touchend checks read on the next tick; no extra settle needed.
export const IMMEDIATE_SETTLE_MS = 0;
