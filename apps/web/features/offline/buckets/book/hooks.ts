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
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import { fetchReaderPayload } from "@/components/app/reader/reader-screen/data/reader-client";
import { emitAppToast } from "@/components/app/core/app-toast";

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
import { deleteBookContent, readOfflineState, type OfflineState } from "./storage";

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

      // Toast on a genuine failure (not on cancellation — that's a user
      // action — and not when we're simply offline: the intent is queued and
      // the download resumes on reconnect, so an error toast would be wrong).
      const offline = typeof navigator !== "undefined" && !navigator.onLine;
      if (outcome.kind === "failed" && !offline) {
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

// Reactive offline state for the book-info card: "loading" until Dexie
// resolves, then "absent" | "auto" | "explicit". Re-reads whenever the save
// status changes (a finished save / removal flips it) and exposes `refresh`
// for actions that mutate the row without touching the save bucket — promoting
// an auto-save to explicit, for example.
export function useBookOfflineState(
  libraryItemId: string,
  saveStatus: string,
): {
  state: OfflineState | "loading";
  fromAutoSave: boolean;
  refresh: () => void;
} {
  const [detail, setDetail] = useState<{
    state: OfflineState | "loading";
    fromAutoSave: boolean;
  }>({ state: "loading", fromAutoSave: false });
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

  return { state: detail.state, fromAutoSave: detail.fromAutoSave, refresh };
}
