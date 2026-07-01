"use client";

// React hooks that wire the Dexie deltas (./local-deltas) through the pure
// composers (./compose) and return UI-ready values.
//
// Reactivity strategy — small but principled:
//   - recompute on mount,
//   - recompute on `visibilitychange → visible` (user came back from
//     reader),
//   - recompute every 30s while visible,
//   - recompute on `online`.
// The home page doesn't need millisecond freshness, and the alternative
// (subscribing to every bucket's internals) adds coupling without
// observable UX gain. The deltas are tiny Dexie scans — well under 5ms
// even with hundreds of rows.

import { useCallback, useEffect, useState } from "react";

import type { HomePayload } from "@/lib/api-types";

import {
  composeBookMinutesRead,
  composeHomeStats,
  composeMastery,
  type HomeStatsDeltas,
} from "./compose";
import {
  readHighlightCountDelta,
  readLocalVolumesRead,
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
  volumesReadLocal: number | null;
};

async function readBundle(): Promise<DeltaBundle> {
  const [sessions, highlightsNet, volumesReadLocal] = await Promise.all([
    readUnsyncedSessionDeltas(),
    readHighlightCountDelta(),
    readLocalVolumesRead(),
  ]);
  return { sessions, highlightsNet, volumesReadLocal };
}

const EMPTY_BUNDLE: DeltaBundle = {
  sessions: {
    totalSeconds: 0,
    byBookSeconds: new Map(),
    byUtcDaySeconds: new Map(),
  },
  highlightsNet: 0,
  volumesReadLocal: null,
};

// Lazy shared bundle so multiple consumers on the same page (StatsPanel
// + MasteryPanel + book metadata sometimes) make ONE Dexie pass each
// recompute, not three.
function useDeltaBundle(): DeltaBundle {
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

export function useComposedHomeStats(
  home: HomePayload | null,
): HomePayload["stats"] | null {
  const bundle = useDeltaBundle();
  if (!home) {
    return null;
  }
  const deltas: HomeStatsDeltas = {
    hoursReadingExtraSeconds: bundle.sessions.totalSeconds,
    highlightsNet: bundle.highlightsNet,
    volumesReadLocal: bundle.volumesReadLocal,
    aiCommentsNet: 0,
  };
  return composeHomeStats(home.stats, deltas);
}

export function useComposedMastery(
  home: HomePayload | null,
): HomePayload["mastery"] | null {
  const bundle = useDeltaBundle();
  if (!home) {
    return null;
  }
  return composeMastery(home.mastery, bundle.sessions.byUtcDaySeconds);
}

export function useComposedBookMinutesRead(
  libraryItemId: string,
  baselineMinutes: number,
): number {
  const bundle = useDeltaBundle();
  const extraSeconds = bundle.sessions.byBookSeconds.get(libraryItemId) ?? 0;
  return composeBookMinutesRead(baselineMinutes, extraSeconds);
}
