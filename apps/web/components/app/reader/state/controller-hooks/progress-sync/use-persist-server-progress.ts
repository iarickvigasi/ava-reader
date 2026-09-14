import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { ReaderLocator, ReaderStatusPayload } from "@/lib/api-types";
import type { ReaderControllerAuth } from "../../../shared/types";
import { persistReaderProgress } from "../../../data/reader-client";
import { READER_STATUS_READY } from "../../../shared/constants";
import { createLocatorKey } from "../../../shared/utils";
import { markProgressSyncedIfUnchanged } from "@/features/offline/buckets/progress";
import { getDb } from "@/features/offline/db";
import {
  evaluatePersistEligibility,
  shouldClearPendingAfterAck,
} from "./use-reader-progress-sync.helpers";

type UsePersistServerProgressInput = ReaderControllerAuth & {
  lastServerAckKeyRef: MutableRefObject<string | null>;
  libraryItemId: string;
  pendingServerLocatorKeyRef: MutableRefObject<string | null>;
  pendingServerLocatorRef: MutableRefObject<ReaderLocator | null>;
  remotePersistenceEnabled: boolean;
  setPayload: Dispatch<SetStateAction<ReaderStatusPayload>>;
};

/**
 * PATCHes the current reading position to the server, deduping against the
 * last acknowledged position so an unchanged locator never re-sends.
 */
export function usePersistServerProgress({
  getToken,
  isLoaded,
  isSignedIn,
  lastServerAckKeyRef,
  libraryItemId,
  pendingServerLocatorKeyRef,
  pendingServerLocatorRef,
  remotePersistenceEnabled,
  setPayload,
}: UsePersistServerProgressInput) {
  const persistPendingProgress = useCallback(
    async (locator: ReaderLocator, keepalive = false) => {
      if (!remotePersistenceEnabled) {
        return null;
      }

      const locatorKey = createLocatorKey(locator);
      const persistEligibility = evaluatePersistEligibility({
        lastServerAckKey: lastServerAckKeyRef.current,
        locatorKey,
        pendingServerLocatorKey: pendingServerLocatorKeyRef.current,
      });

      if (!persistEligibility.shouldPersist) {
        if (persistEligibility.shouldClearPending) {
          pendingServerLocatorRef.current = null;
          pendingServerLocatorKeyRef.current = null;
        }

        return null;
      }

      try {
        const db = getDb();
        const nextProgress = await persistReaderProgress({
          getToken,
          isLoaded,
          isSignedIn,
          keepalive,
          libraryItemId,
          locator,
        });
        if (db !== getDb()) return null;
        const ackKey = createLocatorKey(nextProgress.locator);
        lastServerAckKeyRef.current = ackKey;

        // Use the same atomic acknowledgment as background sync. A newer
        // local position keeps its pending completion contribution.
        await markProgressSyncedIfUnchanged(libraryItemId, locator, nextProgress, db);

        if (
          shouldClearPendingAfterAck({
            ackKey,
            pendingServerLocatorKey: pendingServerLocatorKeyRef.current,
          })
        ) {
          pendingServerLocatorRef.current = null;
          pendingServerLocatorKeyRef.current = null;
        }

        setPayload((current) =>
          current.status === READER_STATUS_READY
            ? {
                ...current,
                progress: nextProgress,
              }
            : current,
        );

        return nextProgress;
      } catch (error) {
        // Progress saves can fail for transient reasons (offline, server hiccup,
        // request aborted on tab close). Surfacing this as an unhandled
        // exception turns up the Next.js error overlay in dev and crashes the
        // reader UI in prod. Instead, swallow the error, let the user know via
        // a toast, and rely on the next debounced save (or pagehide flush) to
        // succeed once connectivity returns.
        if (process.env.NODE_ENV !== "production") {
          console.warn("Reader progress save failed", error);
        }

        // No toast: progress was already written to Dexie (dirty) before this
        // PATCH and the sync runner flushes it on reconnect, so a failed server
        // save is a non-event for the user.
        return null;
      }
    },
    [
      getToken,
      isLoaded,
      isSignedIn,
      lastServerAckKeyRef,
      libraryItemId,
      pendingServerLocatorKeyRef,
      pendingServerLocatorRef,
      remotePersistenceEnabled,
      setPayload,
    ],
  );

  return persistPendingProgress;
}
