// Runs a callback during browser idle time, falling back to a short timeout
// where requestIdleCallback isn't available (Safari, jsdom). Used to defer the
// background primer so it never competes with first paint.
export function scheduleIdle(run: () => void): void {
  const ric = (
    globalThis as typeof globalThis & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    }
  ).requestIdleCallback;
  if (typeof ric === "function") {
    ric(run, { timeout: 5_000 });
  } else {
    setTimeout(run, 1_500);
  }
}
