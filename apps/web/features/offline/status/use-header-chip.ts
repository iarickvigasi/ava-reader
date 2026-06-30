// Drives the single header status slot: returns "offline" | "caching" | "none"
// (see [[11-cache-priming]]). All branching lives in the pure resolveHeaderChip;
// this hook feeds it the reactive online + priming-progress values and the
// clock, remembers when priming completed (for the dwell window), and
// re-renders once when that window expires. The clock read happens in an effect
// (never during render) to keep the component pure.

import { useEffect, useRef, useState } from "react";

import { resolveHeaderChip, type ChipState } from "./header-chip-state";
import { useNetworkState } from "../net/use-network-state";
import { setPrimeProgress } from "./prime-progress";
import { usePrimeProgress } from "./use-prime-progress";

// Hold the "Ready offline" chip this long after priming finishes — a brief
// "done" beat (and all the anti-flicker a fast prime needs).
const DWELL_MS = 5_000;

export function useHeaderChip(): ChipState {
  const online = useNetworkState();
  const progress = usePrimeProgress();
  // When priming completed this episode (ref so updating it can't loop). Written
  // only inside the effect below.
  const completedAtRef = useRef<number | null>(null);
  // Seed synchronously so the Offline chip paints on the first frame (no flash);
  // the effect refines this for the priming chip + its dwell tail.
  const [state, setState] = useState<ChipState>(() =>
    online ? { kind: "none" } : { kind: "offline" },
  );

  useEffect(() => {
    const compute = (): number | null => {
      const result = resolveHeaderChip({
        online,
        progress,
        completedAt: completedAtRef.current,
        now: Date.now(),
        dwellMs: DWELL_MS,
      });
      completedAtRef.current = result.completedAt;
      // The "ready" beat is one-shot: once its dwell elapses, consume it so a
      // later reconnect in the same session doesn't re-flash "Ready offline".
      if (result.state.kind === "none" && progress?.phase === "ready") {
        setPrimeProgress(null);
      }
      setState(result.state);
      return result.timerMs;
    };
    const timerMs = compute();
    if (timerMs === null) {
      return;
    }
    const id = setTimeout(compute, timerMs);
    return () => clearTimeout(id);
  }, [online, progress]);

  return state;
}
