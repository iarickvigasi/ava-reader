import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import type {
  ReaderLocator,
  ReaderStatusPayload,
} from "@/lib/api-types";
import type { ReaderControllerAuth } from "../../shared/types";
import {
  persistReaderProgress,
} from "../../data/reader-client";
import {
  READER_PROGRESS_PERSIST_DEBOUNCE_MS,
  READER_RESUME_PHASE_APPLIED,
  READER_STATUS_READY,
  READER_VISIBILITY_HIDDEN,
  type ReaderResumePhase,
} from "../../shared/constants";
import { createLocatorKey } from "../../shared/utils";
import {
  writeLocalReaderResumeSnapshot,
  type ReaderResumeSnapshot,
} from "@/lib/reader-resume";
import {
  evaluatePersistEligibility,
  shouldClearPendingAfterAck,
  shouldFlushPendingProgress,
} from "./use-reader-progress-sync.helpers";

type UseReaderProgressSyncInput = ReaderControllerAuth & {
  initialResumePhase: ReaderResumePhase;
  initialServerLocator: ReaderLocator | null;
  libraryItemId: string;
  payload: ReaderStatusPayload;
  remotePersistenceEnabled: boolean;
  setPayload: Dispatch<SetStateAction<ReaderStatusPayload>>;
  visibleLocator: ReaderLocator | null;
};

export function useReaderProgressSync({
  getToken,
  initialResumePhase,
  initialServerLocator,
  isLoaded,
  isSignedIn,
  libraryItemId,
  payload,
  remotePersistenceEnabled,
  setPayload,
  visibleLocator,
}: UseReaderProgressSyncInput) {
  const lastServerAckKeyRef = useRef<string | null>(
    createLocatorKey(initialServerLocator),
  );
  const pendingServerLocatorRef = useRef<ReaderLocator | null>(null);
  const pendingServerLocatorKeyRef = useRef<string | null>(null);
  const scheduledPersistTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (scheduledPersistTimeoutRef.current !== null) {
        window.clearTimeout(scheduledPersistTimeoutRef.current);
      }
    };
  }, []);

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
        const nextProgress = await persistReaderProgress({
          getToken,
          isLoaded,
          isSignedIn,
          keepalive,
          libraryItemId,
          locator,
        });
        const ackKey = createLocatorKey(nextProgress.locator);
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
            ? {
                ...current,
                progress: nextProgress,
              }
            : current,
        );

        return nextProgress;
      } catch (error) {
        if (!keepalive) {
          throw error;
        }

        return null;
      }
    },
    [
      getToken,
      isLoaded,
      isSignedIn,
      libraryItemId,
      remotePersistenceEnabled,
      setPayload,
    ],
  );

  useEffect(() => {
    if (
      payload.status !== READER_STATUS_READY ||
      initialResumePhase !== READER_RESUME_PHASE_APPLIED ||
      !visibleLocator
    ) {
      return;
    }

    const nextSnapshot = {
      locator: visibleLocator,
      savedAt: new Date().toISOString(),
      version: 2,
    } satisfies ReaderResumeSnapshot;
    writeLocalReaderResumeSnapshot(libraryItemId, nextSnapshot);

    if (!remotePersistenceEnabled) {
      return;
    }

    const locatorKey = createLocatorKey(visibleLocator);
    pendingServerLocatorRef.current = visibleLocator;
    pendingServerLocatorKeyRef.current = locatorKey;

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

      return;
    }

    if (scheduledPersistTimeoutRef.current !== null) {
      window.clearTimeout(scheduledPersistTimeoutRef.current);
    }

    scheduledPersistTimeoutRef.current = window.setTimeout(() => {
      scheduledPersistTimeoutRef.current = null;
      const locatorToPersist = pendingServerLocatorRef.current;

      if (!locatorToPersist) {
        return;
      }

      void persistPendingProgress(locatorToPersist);
    }, READER_PROGRESS_PERSIST_DEBOUNCE_MS);

    return () => {
      if (scheduledPersistTimeoutRef.current !== null) {
        window.clearTimeout(scheduledPersistTimeoutRef.current);
      }
    };
  }, [
    initialResumePhase,
    libraryItemId,
    payload.status,
    persistPendingProgress,
    remotePersistenceEnabled,
    visibleLocator,
  ]);

  useEffect(() => {
    if (
      !remotePersistenceEnabled ||
      payload.status !== READER_STATUS_READY ||
      initialResumePhase !== READER_RESUME_PHASE_APPLIED
    ) {
      return;
    }

    const flushPendingProgress = () => {
      const locatorToPersist = pendingServerLocatorRef.current;
      const pendingLocatorKey = pendingServerLocatorKeyRef.current;

      if (
        !shouldFlushPendingProgress({
          lastServerAckKey: lastServerAckKeyRef.current,
          pendingLocatorExists: Boolean(locatorToPersist),
          pendingServerLocatorKey: pendingLocatorKey,
        })
      ) {
        return;
      }

      if (scheduledPersistTimeoutRef.current !== null) {
        window.clearTimeout(scheduledPersistTimeoutRef.current);
        scheduledPersistTimeoutRef.current = null;
      }

      void persistPendingProgress(locatorToPersist!, true);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === READER_VISIBILITY_HIDDEN) {
        flushPendingProgress();
      }
    };

    window.addEventListener("pagehide", flushPendingProgress);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", flushPendingProgress);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [
    initialResumePhase,
    payload.status,
    persistPendingProgress,
    remotePersistenceEnabled,
  ]);
}
