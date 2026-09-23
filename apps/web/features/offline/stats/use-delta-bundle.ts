"use client";

// React hooks that wire the Dexie deltas (./local-deltas) through the pure
// composers (./compose) and return UI-ready values.
//
// Book-session/highlight delta and UTC-date refresh:
//   - recompute on mount,
//   - recompute on `visibilitychange → visible` (user came back from
//     reader),
//   - recompute every 30s while visible,
//   - recompute on `online`.
// Home reading and completion totals come from the home live subscription;
// its transactional read reconciles sessions without waiting for this timer.

import { useCallback, useEffect, useState } from "react";

import {
  readHighlightCountDelta,
  readUnsyncedSessionDeltas,
  type UnsyncedSessionDeltas,
} from "./local-deltas";

const RECOMPUTE_INTERVAL_MS = 30_000;

// One Dexie pass produces every input we need. Computing them together
// avoids a render storm from N separate setStates landing in different
// effect batches.
type DeltaBundle = {
  sessions: UnsyncedSessionDeltas;
  highlightsNet: number;
  todayKey: string | null;
};

async function readBundle(): Promise<DeltaBundle> {
  const [sessions, highlightsNet] = await Promise.all([
    readUnsyncedSessionDeltas(),
    readHighlightCountDelta(),
  ]);
  return {
    sessions,
    highlightsNet,
    todayKey: new Date().toISOString().slice(0, 10),
  };
}

const EMPTY_BUNDLE: DeltaBundle = {
  sessions: {
    totalSeconds: 0,
    byBookSeconds: new Map(),
    byUtcDaySeconds: new Map(),
  },
  highlightsNet: 0,
  todayKey: null,
};

// Refresh the UTC date with the deltas so mounted charts advance after midnight.
// Keep it unset on the initial render to preserve the server hydration snapshot.
export function useDeltaBundle(): DeltaBundle {
  const [bundle, setBundle] = useState<DeltaBundle>(EMPTY_BUNDLE);

  const recompute = useCallback(() => {
    void readBundle().then((next) => setBundle(next));
  }, []);

  useEffect(() => {
    recompute();
    const interval = window.setInterval(recompute, RECOMPUTE_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        recompute();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", recompute);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", recompute);
    };
  }, [recompute]);

  return bundle;
}
