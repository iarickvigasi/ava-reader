import { TOUCH_RECENCY_MS } from "./timing";

export type TouchActivity = {
  // A reader touch began: mark active and stamp the time.
  start(): void;
  // The touch ended/canceled, or a new touch began outside the reader: no
  // longer active. The last-start timestamp is kept so followsRecentTouch()
  // still reports true through the recency window.
  end(): void;
  // Is a reader touch currently down?
  isActive(): boolean;
  // Does the current moment still "belong" to a reader touch — either one is
  // down, or one lifted within TOUCH_RECENCY_MS? `selectionchange` and
  // `contextmenu` are origin-less document events that arrive a beat *after*
  // touchend, so this short tail is how the hook attributes them back to the
  // gesture (and keeps a desktop mouse's events out).
  followsRecentTouch(): boolean;
};

// Tracks whether a text-selection gesture is (or just was) happening inside the
// reader. Pure and clock-injectable so the recency window is unit-testable
// without real time. Holds the "is a reader touch down" flag and the last-start
// timestamp that previously lived as loose closure variables in the hook.
export function createTouchActivity(now: () => number = Date.now): TouchActivity {
  let active = false;
  let lastStartedAt = Number.NEGATIVE_INFINITY;

  return {
    start() {
      active = true;
      lastStartedAt = now();
    },
    end() {
      active = false;
    },
    isActive() {
      return active;
    },
    followsRecentTouch() {
      return active || now() - lastStartedAt <= TOUCH_RECENCY_MS;
    },
  };
}
