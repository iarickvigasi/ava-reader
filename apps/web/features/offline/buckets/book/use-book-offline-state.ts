"use client";

import { useCallback, useEffect, useState } from "react";

import { readOfflineState, type OfflineState } from "./storage";

// Reactive offline state for the book-info card: "loading" until Dexie
// resolves, then "absent" | "auto" | "explicit", plus `offlineRequested` (the
// synced intent) so the card can show "Download queued" before any content
// exists. Re-reads whenever the save status changes (a finished save / removal
// flips it) and exposes `refresh` for actions that mutate the row without
// touching the save bucket — promoting an auto-save to explicit, for example.
export function useBookOfflineState(
  libraryItemId: string,
  saveStatus: string,
): {
  state: OfflineState | "loading";
  fromAutoSave: boolean;
  offlineRequested: boolean;
  refresh: () => void;
} {
  const [detail, setDetail] = useState<{
    state: OfflineState | "loading";
    fromAutoSave: boolean;
    offlineRequested: boolean;
  }>({ state: "loading", fromAutoSave: false, offlineRequested: false });
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    void readOfflineState(libraryItemId).then((next) => {
      if (!cancelled) {
        setDetail(next);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [libraryItemId, saveStatus, tick]);

  return {
    state: detail.state,
    fromAutoSave: detail.fromAutoSave,
    offlineRequested: detail.offlineRequested,
    refresh,
  };
}
