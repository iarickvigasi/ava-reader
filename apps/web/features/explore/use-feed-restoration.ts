"use client";

import type { GridRestorer } from "./restore-virtual-grid";
import { onFeedNavigation } from "./feed-navigation";
import { readFeedAnchor, restoreFeedPosition } from "./feed-position";
import { useEffect, useLayoutEffect, useRef } from "react";
import {
  readFeedSnapshot,
  saveFeedSnapshot,
  type FeedLoaded,
  type FeedRequest,
} from "./catalog-feed-snapshot";

export function useFeedRestoration(
  request: FeedRequest | null,
  loaded: FeedLoaded | null,
  restoreRef?: GridRestorer,
) {
  const latest = useRef({ request, loaded });
  const restored = useRef<string | null>(null);
  useLayoutEffect(() => {
    latest.current = { request, loaded };
  }, [request, loaded]);
  useLayoutEffect(() => {
    let scroll = window.scrollY;
    let leaving = false;
    const record = () => {
      if (!leaving) scroll = window.scrollY;
    };
    const save = () => {
      const current = latest.current;
      if (
        current.request &&
        current.loaded?.key === current.request.key &&
        restored.current === current.request.key
      )
        saveFeedSnapshot(
          current.request,
          current.loaded,
          scroll,
          readFeedAnchor(),
        );
    };
    const detach = onFeedNavigation(() => {
      if (leaving) return;
      record();
      save();
      leaving = true;
    });
    window.addEventListener("scroll", record, { passive: true });
    return () => {
      window.removeEventListener("scroll", record);
      detach();
      // Next Activity restores component state but reactivates effects.
      restored.current = null;
    };
  }, []);
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
