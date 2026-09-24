"use client";

import { useOfflineAuth as useAuth } from "@/features/auth/use-offline-auth";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { useAnnotationLoad } from "@/features/annotations/use-annotation-load";
import { getPublicApiBaseUrl } from "@/lib/api";
import type { ReaderRangeLocator } from "@/lib/api-types";
import {
  enqueueDelete,
  enqueueUpsert,
  flushBucket,
  generateHighlightId,
  getHighlightsBucket,
  selectStableHighlights,
  setBucketAuth,
  subscribeToDrops,
  subscribeToHighlights,
  type HighlightColor,
  type HighlightRecord,
} from "@/features/offline/buckets/highlights";
import { useSyncTriggers } from "@/features/offline/net/use-sync-triggers";
import { emitAppToast } from "@/components/app/core/app-toast";

type UseHighlightsResult = {
  highlights: HighlightRecord[];
  loadStatus: ReturnType<typeof useAnnotationLoad>["loadStatus"];
  refetch: () => void;
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
    () =>
      selectStableHighlights(getHighlightsBucket(libraryItemId, apiBaseUrl)),
    [apiBaseUrl, libraryItemId],
  );
  const highlights = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const { loadStatus, refetch } = useAnnotationLoad(
    libraryItemId,
    "highlights",
  );

  // Background flush triggers. No mount kick — the initial-load effect above
  // already flushes once the server snapshot lands.
  const tryFlush = useCallback(() => {
    void flushBucket(libraryItemId, apiBaseUrl);
  }, [apiBaseUrl, libraryItemId]);
  useSyncTriggers(tryFlush);

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

  const upsertHighlight = useCallback<UseHighlightsResult["upsertHighlight"]>(
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

  const deleteHighlight = useCallback<UseHighlightsResult["deleteHighlight"]>(
    (id) => {
      enqueueDelete(libraryItemId, apiBaseUrl, id);
    },
    [apiBaseUrl, libraryItemId],
  );

  return useMemo(
    () => ({
      highlights,
      upsertHighlight,
      deleteHighlight,
      loadStatus,
      refetch,
    }),
    [highlights, upsertHighlight, deleteHighlight, loadStatus, refetch],
  );
}
