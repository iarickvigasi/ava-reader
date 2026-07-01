"use client";

import { useAuth } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import { getPublicApiBaseUrl } from "@/lib/api";
import type { ReaderRangeLocator } from "@/lib/api-types";
import {
  applyServerSnapshot,
  enqueueDelete,
  enqueueUpsert,
  flushBucket,
  generateHighlightId,
  getHighlightsBucket,
  selectStableHighlights,
  setBucketAuth,
  subscribeToDrops,
  subscribeToHighlights,
  toHighlightRecord,
  type HighlightColor,
  type HighlightRecord,
} from "@/features/offline/buckets/highlights";
import { emitAppToast } from "@/components/app/core/app-toast";

type UseHighlightsResult = {
  highlights: HighlightRecord[];
  upsertHighlight: (input: {
    id?: string;
    excerpt: string;
    color: HighlightColor;
    locator: ReaderRangeLocator | null;
  }) => string;
  deleteHighlight: (id: string) => void;
};

// Single shared empty array for the SSR / pre-hydration snapshot. Must be a
// stable reference: useSyncExternalStore calls getServerSnapshot repeatedly
// and bails out with "infinite loop" if it sees a fresh array each time.
const EMPTY_SERVER_SNAPSHOT: HighlightRecord[] = [];
const getServerSnapshot = (): HighlightRecord[] => EMPTY_SERVER_SNAPSHOT;

// Server snapshot loader. Failures are non-blocking: localStorage already
// seeded the UI synchronously, so a failed GET just means the user keeps
// seeing whatever was last successfully synced.
export function useHighlights(libraryItemId: string): UseHighlightsResult {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const t = useTranslations("reader.highlights");
  const apiBaseUrl = getPublicApiBaseUrl();

  // Keep the latest token-getter on the bucket so background flushes
  // (online/visibility events) can authenticate without going through React.
  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return;
    }
    setBucketAuth(libraryItemId, apiBaseUrl, getToken);
  }, [apiBaseUrl, getToken, isLoaded, isSignedIn, libraryItemId]);

  const subscribe = useCallback(
    (listener: () => void) =>
      subscribeToHighlights(libraryItemId, apiBaseUrl, listener),
    [apiBaseUrl, libraryItemId],
  );
  const getSnapshot = useCallback(
    () => selectStableHighlights(getHighlightsBucket(libraryItemId, apiBaseUrl)),
    [apiBaseUrl, libraryItemId],
  );
  const highlights = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  // Initial load: GET the server list, replace the snapshot. Pending writes
  // stay queued until flushed.
  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return;
    }
    const controller = new AbortController();
    const run = async () => {
      const token = await getToken();
      if (!token) {
        return;
      }
      const response = await fetch(
        `${apiBaseUrl}/api/library/${encodeURIComponent(
          libraryItemId,
        )}/annotations`,
        {
          method: "GET",
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        },
      );
      if (!response.ok) {
        emitAppToast({
          message: t("loadFailed"),
          tone: "warning",
        });
        return;
      }
      const data = (await response.json()) as {
        items?: Parameters<typeof toHighlightRecord>[0][];
      };
      if (controller.signal.aborted) {
        return;
      }
      const records = (data.items ?? []).map(toHighlightRecord);
      applyServerSnapshot(libraryItemId, apiBaseUrl, records);
      void flushBucket(libraryItemId, apiBaseUrl);
    };
    run().catch(() => {
      if (!controller.signal.aborted) {
        emitAppToast({
          message: t("loadFailed"),
          tone: "warning",
        });
      }
    });
    return () => {
      controller.abort();
    };
  }, [apiBaseUrl, getToken, isLoaded, isSignedIn, libraryItemId, t]);

  // Background flush triggers. Re-attempts when the network comes back, the
  // tab becomes visible (mobile suspends fetches in the background), or the
  // user signs in. `pagehide` flushes the debounced localStorage write so
  // we never lose a queued mutation because the user closed the tab inside
  // the 100ms persist window.
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const tryFlush = () => {
      void flushBucket(libraryItemId, apiBaseUrl);
    };
    const tryFlushWhenVisible = () => {
      if (document.visibilityState === "visible") {
        tryFlush();
      }
    };
    // No more `pagehide` flush — Dexie writes happen in lockstep with each
    // mutation, so there's no debounced state that could be lost when the
    // tab closes inside a write window.
    window.addEventListener("online", tryFlush);
    document.addEventListener("visibilitychange", tryFlushWhenVisible);
    return () => {
      window.removeEventListener("online", tryFlush);
      document.removeEventListener("visibilitychange", tryFlushWhenVisible);
    };
  }, [apiBaseUrl, libraryItemId]);

  // Surface permanent failures (400/403/422/etc.) as toasts so the user
  // knows their highlight didn't save, and why. The store already dropped
  // the mutation from the queue by the time we get here — they'll need to
  // re-attempt the action.
  useEffect(() => {
    return subscribeToDrops(libraryItemId, apiBaseUrl, (event) => {
      emitAppToast({
        tone: "warning",
        message: t("saveFailed", { reason: event.reason }),
      });
    });
  }, [apiBaseUrl, libraryItemId, t]);

  const upsertHighlight = useCallback<
    UseHighlightsResult["upsertHighlight"]
  >(
    ({ id, excerpt, color, locator }) => {
      const finalId = id ?? generateHighlightId();
      enqueueUpsert(libraryItemId, apiBaseUrl, {
        id: finalId,
        excerpt,
        color,
        locator,
      });
      return finalId;
    },
    [apiBaseUrl, libraryItemId],
  );

  const deleteHighlight = useCallback<
    UseHighlightsResult["deleteHighlight"]
  >(
    (id) => {
      enqueueDelete(libraryItemId, apiBaseUrl, id);
    },
    [apiBaseUrl, libraryItemId],
  );

  return useMemo(
    () => ({ highlights, upsertHighlight, deleteHighlight }),
    [highlights, upsertHighlight, deleteHighlight],
  );
}
