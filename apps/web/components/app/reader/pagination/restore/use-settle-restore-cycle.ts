import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useRenderSyncedRef } from "./use-render-synced-ref";

/**
 * Owns the "restore settled" signal. After the decision effect places the
 * reader, it schedules a frame that marks the current restore cycle settled
 * (which flips restorePhase to "settled" and lets locator publishing resume).
 * Cancelled on chapter/intent change and on unmount so a stale frame can't mark
 * a new cycle settled prematurely.
 */
export function useSettleRestoreCycle(activeRestoreCycleKey: string) {
  const currentCycleRef = useRenderSyncedRef(activeRestoreCycleKey);
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
    (restoreCycleKey: string, onSettled?: () => void) => {
      cancelSettle();
      const frame = window.requestAnimationFrame(() => {
        if (
          frameRef.current !== frame ||
          currentCycleRef.current !== restoreCycleKey
        )
          return;
        frameRef.current = null;
        setSettledRestoreCycleKey(restoreCycleKey);
        onSettled?.();
      });
      frameRef.current = frame;
    },
    [cancelSettle, currentCycleRef],
  );

  useLayoutEffect(() => cancelSettle, [activeRestoreCycleKey, cancelSettle]);

  return { cancelSettle, scheduleSettle, settledRestoreCycleKey };
}
