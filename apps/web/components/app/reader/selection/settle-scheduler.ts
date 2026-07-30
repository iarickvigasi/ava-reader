export type SettleScheduler = {
  // Schedule `run` after `delayMs`, canceling any previously scheduled run.
  schedule(delayMs: number, run: () => void): void;
  // Cancel the pending run, if any. Safe to call when nothing is scheduled.
  cancel(): void;
};

// A single-slot debounce timer: only the most recently scheduled run is ever
// kept, so a burst of selection events (touchend → selectionchange, or a
// synthetic mouseup after touchend) settles into one check instead of several.
// Wraps window's timer calls so the selection hooks don't juggle timer ids.
export function createSettleScheduler(win: Window): SettleScheduler {
  let timer: number | null = null;

  const cancel = () => {
    if (timer === null) {
      return;
    }
    win.clearTimeout(timer);
    timer = null;
  };

  const schedule = (delayMs: number, run: () => void) => {
    cancel();
    timer = win.setTimeout(() => {
      timer = null;
      run();
    }, delayMs);
  };

  return { schedule, cancel };
}
