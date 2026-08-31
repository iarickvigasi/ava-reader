import { LONG_PRESS_MS, LONG_PRESS_SLOP_PX } from "../capture/timing";

// The long press that starts an iOS selection: it remembers where the finger
// went down, fires once the finger has rested there long enough, and gives up
// as soon as the finger drifts (that gesture is a swipe, not a selection).
export function createPressTimer(win: Window, onPress: () => void) {
  let timer: number | null = null;
  let origin = { x: 0, y: 0 };

  const cancel = () => {
    if (timer !== null) {
      win.clearTimeout(timer);
      timer = null;
    }
  };

  return {
    cancel,
    arm: (x: number, y: number) => {
      cancel();
      origin = { x, y };
      timer = win.setTimeout(onPress, LONG_PRESS_MS);
    },
    origin: () => origin,
    cancelIfDrifted: (x: number, y: number) => {
      const hasDrifted =
        Math.abs(x - origin.x) > LONG_PRESS_SLOP_PX ||
        Math.abs(y - origin.y) > LONG_PRESS_SLOP_PX;

      if (hasDrifted) {
        cancel();
      }
    },
  };
}
