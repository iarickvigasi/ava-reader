"use client";

// Dexie-backed AI comments hook. Subscribes to the per-book bucket; reads
// the merged snapshot+pending view. The signature matches the prior
// in-memory version so existing callers (AiCommentsProvider /
// PanelViewModel / data formatters) stay unchanged.

import { useAuth } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import { emitAppToast } from "@/components/app/core/app-toast";
import {
  applyServerSnapshot,
  enqueueDelete,
  enqueueGenerate,
  flushBucket,
  getAiCommentsBucket,
  selectStableAiComments,
  setBucketAuth,
  subscribeToAiComments,
  subscribeToDrops,
  type AiCommentRecord,
  type PendingMutation,
  type ServerAiComment,
} from "@/features/offline/buckets/ai-comments";
import { getPublicApiBaseUrl } from "@/lib/api";

// Re-export so existing callers (ai-comments-data, etc.) keep working.
export type { AiCommentRecord };

type UseAiCommentsResult = {
  comments: AiCommentRecord[];
  refetch: () => void;
  deleteAiComment: (id: string) => Promise<void>;
  // New: enqueue a generate intent. Used by the AI toolbox to fall back to
  // the offline queue when the user is offline (or just to persist the
  // streamed result regardless).
  enqueueGenerateIntent: (
    mutation: Extract<
      PendingMutation,
      {
        kind:
          | "generate.translate"
          | "generate.etymology"
          | "generate.explain";
      }
    >,
  ) => void;
};

export function useAiComments(libraryItemId: string): UseAiCommentsResult {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const t = useTranslations("reader.aiComments");
  const apiBaseUrl = getPublicApiBaseUrl();
  const [refetchTick, setRefetchTick] = useState(0);

  // Subscribe to the bucket. selectStableAiComments memoises by `version`
  // so unrelated renders see referential equality.
  const comments = useSyncExternalStore(
    (listener) => subscribeToAiComments(libraryItemId, apiBaseUrl, listener),
    () => selectStableAiComments(getAiCommentsBucket(libraryItemId, apiBaseUrl)),
    () => [],
  );

  // Keep the bucket's token getter fresh — Clerk hooks return new identities
  // on every render. The bucket persists the latest one for background
  // flushes triggered from `online` / `visibilitychange`.
  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return;
    }
    setBucketAuth(libraryItemId, apiBaseUrl, getToken);
  }, [apiBaseUrl, getToken, isLoaded, isSignedIn, libraryItemId]);

  // Initial GET + refetch on tick bumps. On 4xx/5xx, surface a toast — the
  // bucket still works from whatever Dexie has cached.
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
        )}/ai-comments`,
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
        if (!controller.signal.aborted) {
          emitAppToast({ message: t("highlightsLoadFailed"), tone: "warning" });
        }
        return;
      }
      const data = (await response.json()) as { items?: ServerAiComment[] };
      if (!controller.signal.aborted) {
        applyServerSnapshot(libraryItemId, apiBaseUrl, data.items ?? []);
      }
    };
    run().catch(() => {
      // Network blip while offline. Cached bucket is still served.
    });
    return () => controller.abort();
  }, [
    apiBaseUrl,
    getToken,
    isLoaded,
    isSignedIn,
    libraryItemId,
    refetchTick,
    t,
  ]);

  // Drain queue + retry on `online` and on tab regaining visibility.
  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
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
  }, [apiBaseUrl, isLoaded, isSignedIn, libraryItemId]);

  // Surface DropEvents as toasts. Same pattern as highlights.
  useEffect(() => {
    return subscribeToDrops(libraryItemId, apiBaseUrl, (event) => {
      const message =
        event.mutationKind === "delete" ? t("deleteFailed") : event.reason;
      emitAppToast({ message, tone: "warning" });
    });
  }, [apiBaseUrl, libraryItemId, t]);

  const refetch = useCallback(() => setRefetchTick((tick) => tick + 1), []);

  const deleteAiComment = useCallback(
    async (id: string) => {
      enqueueDelete(libraryItemId, apiBaseUrl, id);
    },
    [apiBaseUrl, libraryItemId],
  );

  const enqueueGenerateIntent = useCallback(
    (
      mutation: Extract<
        PendingMutation,
        {
          kind:
            | "generate.translate"
            | "generate.etymology"
            | "generate.explain";
        }
      >,
    ) => {
      enqueueGenerate(libraryItemId, apiBaseUrl, mutation);
    },
    [apiBaseUrl, libraryItemId],
  );

  return { comments, refetch, deleteAiComment, enqueueGenerateIntent };
}
