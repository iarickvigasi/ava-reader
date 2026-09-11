"use client";

// Dexie-backed AI comments hook. Subscribes to the per-book bucket; reads
// the merged snapshot+pending view. The signature matches the prior
// in-memory version so existing callers (AiCommentsProvider /
// PanelViewModel / data formatters) stay unchanged.

import { useAuth } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useSyncExternalStore } from "react";

import { useAnnotationLoad } from "@/features/annotations/use-annotation-load";
import { emitAppToast } from "@/components/app/core/app-toast";
import {
  enqueueDelete,
  enqueueGenerate,
  flushBucket,
  getAiCommentsBucket,
  getAiCommentsServerSnapshot,
  selectStableAiComments,
  setBucketAuth,
  subscribeToAiComments,
  subscribeToDrops,
  type AiCommentRecord,
  type PendingMutation,
} from "@/features/offline/buckets/ai-comments";
import { useSyncTriggers } from "@/features/offline/net/use-sync-triggers";
import { getPublicApiBaseUrl } from "@/lib/api";

// Re-export so existing callers (ai-comments-data, etc.) keep working.
export type { AiCommentRecord };

type UseAiCommentsResult = {
  comments: AiCommentRecord[];
  loadStatus: ReturnType<typeof useAnnotationLoad>["loadStatus"];
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
  const { loadStatus, refetch } = useAnnotationLoad(libraryItemId, "comments");

  // Subscribe to the bucket. selectStableAiComments memoises by `version`
  // so unrelated renders see referential equality; the server snapshot is a
  // stable module-level empty list for the same reason.
  const comments = useSyncExternalStore(
    (listener) => subscribeToAiComments(libraryItemId, apiBaseUrl, listener),
    () => selectStableAiComments(getAiCommentsBucket(libraryItemId, apiBaseUrl)),
    getAiCommentsServerSnapshot,
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

  // Drain queue + retry on `online` and on tab regaining visibility.
  const tryFlush = useCallback(() => {
    void flushBucket(libraryItemId, apiBaseUrl);
  }, [apiBaseUrl, libraryItemId]);
  useSyncTriggers(isLoaded && isSignedIn ? tryFlush : null);

  // Surface delete DropEvents as toasts. Generate failures are shown inline
  // in the toolbox panel (the failed comment carries the reason), so they no
  // longer raise a toast — deletes have no inline surface and still do.
  useEffect(() => {
    return subscribeToDrops(libraryItemId, apiBaseUrl, (event) => {
      if (event.mutationKind !== "delete") {
        return;
      }
      emitAppToast({ message: t("deleteFailed"), tone: "warning" });
    });
  }, [apiBaseUrl, libraryItemId, t]);

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

  return { comments, refetch, deleteAiComment, enqueueGenerateIntent, loadStatus };
}
