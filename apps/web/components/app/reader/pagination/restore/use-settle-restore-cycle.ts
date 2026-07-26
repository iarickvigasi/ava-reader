import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Owns the "restore settled" signal. After the decision effect places the
 * reader, it schedules a frame that marks the current restore cycle settled
 * (which flips restorePhase to "settled" and lets locator publishing resume).
 * Cancelled on chapter/intent change and on unmount so a stale frame can't mark
 * a new cycle settled prematurely.
 */
export function useSettleRestoreCycle() {
  const frameRef = useRef<number | null>(null);
  const [settledRestoreCycleKey, setSettledRestoreCycleKey] = useState<
    string | null
  >(null);

  const cancelSettle = useCallback(() => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  const scheduleSettle = useCallback(
    (restoreCycleKey: string) => {
      cancelSettle();
      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null;
        setSettledRestoreCycleKey(restoreCycleKey);
      });
    },
    [cancelSettle],
  );

  useEffect(() => cancelSettle, [cancelSettle]);

  return { cancelSettle, scheduleSettle, settledRestoreCycleKey };
}
