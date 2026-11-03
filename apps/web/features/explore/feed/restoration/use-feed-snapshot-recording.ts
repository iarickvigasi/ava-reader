"use client";
import { useLayoutEffect, useRef, type RefObject } from "react";
import type { FeedRequest, FeedLoaded } from "../types";
import { saveFeedSnapshot } from "../catalog-feed-snapshot";
import { onFeedNavigation } from "./feed-navigation";
import { readFeedAnchor } from "./read-feed-anchor";
export function useFeedSnapshotRecording(
  request: FeedRequest | null,
  loaded: FeedLoaded | null,
  restored: RefObject<string | null>,
) {
  const latest = useRef({ request, loaded });
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
  }, [restored]);
}
