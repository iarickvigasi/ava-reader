"use client";

// React bindings for the offline book bucket.
//
// useBookSaveStatus     — subscribes to per-book save status / progress.
// useSaveBook           — exposes `save({ kind })` + `remove()` callbacks
//                         wired to the real Clerk-authenticated fetcher,
//                         with a storage-quota pre-check and user-visible
//                         toasts on quota / save failures.
//
// The non-React save orchestrator lives in ./download — these hooks just
// supply the auth-aware fetchers, surface side effects (toasts, quota
// probes) and bridge React state. Keeping the orchestrator pure makes it
// unit-testable without Clerk in scope.

import { useAuth } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import { useCallback, useSyncExternalStore } from "react";

import { fetchReaderPayload } from "@/components/app/reader/data/reader-client";
import { emitAppToast } from "@/components/app/core/app-toast";
import { isOnline } from "@/features/offline/net/net-state";

import { shouldToastSaveFailure } from "./save-toast";

import {
  abortSaveAndWait,
  getBookSaveSnapshot,
  getServerSnapshot,
  setStatus,
  subscribeToBookSave,
  type BookSaveSnapshot,
} from "./bucket";
import {
  saveBookOffline,
  type SaveOutcome,
} from "./download";
import { checkStorageQuota } from "./quota";
import { deleteBookContent } from "./storage";

export function useBookSaveStatus(libraryItemId: string): BookSaveSnapshot {
  // We re-derive a fresh "thunked" subscribe + snapshot per id so different
  // books don't share each other's listener list. The store itself is
  // module-level; this is just a per-id view.
  const subscribe = useCallback(
    (listener: () => void) => subscribeToBookSave(listener),
    [],
  );
  const getSnapshot = useCallback(
    () => getBookSaveSnapshot(libraryItemId),
    [libraryItemId],
  );
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useSaveBook(libraryItemId: string) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const t = useTranslations("offline.toast");

  const save = useCallback(
    async (
      kind: "auto" | "explicit",
      signal?: AbortSignal,
    ): Promise<SaveOutcome> => {
      // Quota guard. Cheap probe (navigator.storage.estimate) — fail fast
      // with a toast before we start fetching chapters and writing to disk.
      const quota = await checkStorageQuota();
      if (!quota.ok) {
        emitAppToast({ message: t("quotaLow"), tone: "warning" });
        // Reflect the refusal in the bucket so any UI watching save status
        // (the button) returns to idle rather than spinning forever.
        setStatus(libraryItemId, {
          status: "failed",
          error: "quota-low",
          currentChapters: 0,
          totalChapters: 0,
        });
        return { kind: "failed", reason: "quota-low" };
      }

      const outcome = await saveBookOffline({
        libraryItemId,
        saveKind: kind,
        signal,
        fetchChapter: (id, chapterId, fetchSignal) =>
          fetchReaderPayload({
            getToken,
            isLoaded,
            isSignedIn,
            libraryItemId: id,
            chapterId,
            signal: fetchSignal,
          }),
        fetchCover: async (url, fetchSignal) => {
          try {
            const response = await fetch(url, { signal: fetchSignal });
            if (!response.ok) {
              return null;
            }
            return await response.blob();
          } catch {
            return null;
          }
        },
      });

      // Only an explicit, user-initiated save that fails while genuinely
      // online warrants a toast. Auto-saves (every book-open) stay silent, and
      // offline failures are queued to resume on reconnect. Uses net-state, not
      // navigator.onLine (unreliably true when offline).
      if (shouldToastSaveFailure(outcome, kind, isOnline())) {
        emitAppToast({ message: t("saveFailed"), tone: "error" });
      }

      return outcome;
    },
    [getToken, isLoaded, isSignedIn, libraryItemId, t],
  );

  const remove = useCallback(async () => {
    await deleteBookContent(libraryItemId);
  }, [libraryItemId]);

  // Aborts an in-flight save for this book and resolves once the orchestrator
  // has torn down its partial rows (returning the book to "not saved").
  const cancel = useCallback(
    () => abortSaveAndWait(libraryItemId),
    [libraryItemId],
  );

  return { save, remove, cancel };
}
