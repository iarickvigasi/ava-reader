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
  subscribeToHighlights,
  toHighlightRecord,
  type HighlightColor,
  type HighlightRecord,
} from "@/lib/highlights-store";
import { emitReaderToast } from "../reader-toast";

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
  const getServerSnapshot = useCallback(
    (): HighlightRecord[] => [],
    [],
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
        emitReaderToast({
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
        emitReaderToast({
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
  // user signs in.
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
    window.addEventListener("online", tryFlush);
    document.addEventListener("visibilitychange", tryFlushWhenVisible);
    return () => {
      window.removeEventListener("online", tryFlush);
      document.removeEventListener("visibilitychange", tryFlushWhenVisible);
    };
  }, [apiBaseUrl, libraryItemId]);

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
