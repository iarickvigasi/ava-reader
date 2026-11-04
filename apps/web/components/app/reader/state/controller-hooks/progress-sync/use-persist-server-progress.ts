import {
  useCallback,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import type { ReaderLocator, ReaderStatusPayload } from "@/lib/api-types";
import type { ReaderControllerAuth } from "../../../shared/types";
import { READER_STATUS_READY } from "../../../shared/constants";
import { createLocatorKey } from "../../../shared/utils";
import { syncProgress } from "@/features/offline/buckets/progress";
import { getDb } from "@/features/offline/db";
import {
  evaluatePersistEligibility,
  shouldClearPendingAfterAck,
} from "./use-reader-progress-sync.helpers";

type Input = ReaderControllerAuth & {
  lastServerAckKeyRef: MutableRefObject<string | null>;
  libraryItemId: string;
  pendingServerLocatorKeyRef: MutableRefObject<string | null>;
  pendingServerLocatorRef: MutableRefObject<ReaderLocator | null>;
  remotePersistenceEnabled: boolean;
  setPayload: Dispatch<SetStateAction<ReaderStatusPayload>>;
};

export function usePersistServerProgress(input: Input) {
  const {
    getToken,
    isLoaded,
    isSignedIn,
    lastServerAckKeyRef,
    libraryItemId,
    pendingServerLocatorKeyRef,
    pendingServerLocatorRef,
    remotePersistenceEnabled,
    setPayload,
  } = input;
  return useCallback(
    async (locator: ReaderLocator, keepalive = false) => {
      if (!remotePersistenceEnabled || !isLoaded || !isSignedIn) return null;
      const eligibility = evaluatePersistEligibility({
        lastServerAckKey: lastServerAckKeyRef.current,
        locatorKey: createLocatorKey(locator),
        pendingServerLocatorKey: pendingServerLocatorKeyRef.current,
      });
      if (!eligibility.shouldPersist) {
        if (eligibility.shouldClearPending) {
          pendingServerLocatorRef.current = null;
          pendingServerLocatorKeyRef.current = null;
        }
        return null;
      }
      try {
        const db = getDb();
        // Upload the durable write, including its original read time and acknowledgment fence.
        const progress = await syncProgress(libraryItemId, getToken, {
          keepalive,
        });
        if (!progress || db !== getDb()) return null;
        const ackKey = createLocatorKey(progress.locator);
        lastServerAckKeyRef.current = ackKey;
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
            ? { ...current, progress }
            : current,
        );
        return progress;
      } catch {
        // The progress bucket retains failed writes and schedules another attempt.
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
}
