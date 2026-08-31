// Mouse and touchend checks read on the next tick; the browser has settled the
// selection by then, so no extra delay is needed.
export const IMMEDIATE_SETTLE_MS = 0;

// iOS runs the app's own selection gesture (spec 1.6 Behaviour 8): how long a
// finger must rest before the word under it is selected, how far it may drift
// while resting, and how near a handle a touch counts as grabbing it.
export const LONG_PRESS_MS = 350;
export const LONG_PRESS_SLOP_PX = 10;
export const HANDLE_GRAB_RADIUS_PX = 22;
