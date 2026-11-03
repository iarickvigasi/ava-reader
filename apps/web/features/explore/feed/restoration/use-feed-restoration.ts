"use client";
import { useEffect, useRef } from "react";
import type { GridRestorer } from "../../grid/types";
import type { FeedRequest, FeedLoaded } from "../types";
import { readFeedSnapshot } from "../catalog-feed-snapshot";
import { restoreFeedPosition } from "./restore-feed-position";
import { useFeedSnapshotRecording } from "./use-feed-snapshot-recording";
export function useFeedRestoration(
  request: FeedRequest | null,
  loaded: FeedLoaded | null,
  restoreRef?: GridRestorer,
) {
  const restored = useRef<string | null>(null);
  useFeedSnapshotRecording(request, loaded, restored);
  const key = request?.key;
  const loadedKey = loaded?.key;
  useEffect(() => {
    if (!key || loadedKey !== key || restored.current === key) return;
    const saved = readFeedSnapshot(key);
    restored.current = key;
    if (saved)
      return (
        restoreRef?.current?.(saved.scroll, saved.anchor) ??
        restoreFeedPosition(saved.scroll, saved.anchor)
      );
  }, [key, loadedKey, restoreRef]);
}
