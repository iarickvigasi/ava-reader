import { describe, expect, it } from "vitest";
import { createTouchActivity } from "./touch-activity";
import { TOUCH_RECENCY_MS } from "./timing";

// A hand-cranked clock so the recency window is tested deterministically.
function createClock(start = 0) {
  let nowMs = start;
  return {
    now: () => nowMs,
    advance(ms: number) {
      nowMs += ms;
    },
  };
}

describe("createTouchActivity", () => {
  it("is idle before any touch", () => {
    const activity = createTouchActivity(createClock().now);

    expect(activity.isActive()).toBe(false);
    expect(activity.followsRecentTouch()).toBe(false);
  });

  it("is active and recent while a touch is down", () => {
    const activity = createTouchActivity(createClock().now);

    activity.start();

    expect(activity.isActive()).toBe(true);
    expect(activity.followsRecentTouch()).toBe(true);
  });

  it("stays recent for the window after the touch ends, then lapses", () => {
    const clock = createClock();
    const activity = createTouchActivity(clock.now);

    activity.start();
    activity.end();

    // No longer down, but still within the recency tail.
    expect(activity.isActive()).toBe(false);
    expect(activity.followsRecentTouch()).toBe(true);

    // Exactly at the boundary still counts (<=).
    clock.advance(TOUCH_RECENCY_MS);
    expect(activity.followsRecentTouch()).toBe(true);

    // One tick past the window and it no longer follows a reader touch.
    clock.advance(1);
    expect(activity.followsRecentTouch()).toBe(false);
  });

  it("counts as recent while down even long after the last start", () => {
    const clock = createClock();
    const activity = createTouchActivity(clock.now);

    activity.start();
    clock.advance(TOUCH_RECENCY_MS * 10);

    // A finger held down past the window is still active, so still recent.
    expect(activity.followsRecentTouch()).toBe(true);
  });

  it("end() without a prior start leaves it idle", () => {
    const activity = createTouchActivity(createClock().now);

    activity.end();

    expect(activity.isActive()).toBe(false);
    expect(activity.followsRecentTouch()).toBe(false);
  });
});
