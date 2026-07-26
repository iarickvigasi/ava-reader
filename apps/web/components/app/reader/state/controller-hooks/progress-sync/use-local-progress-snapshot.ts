import { useEffect, type MutableRefObject } from "react";
import type { ReaderLocator, ReaderStatusPayload } from "@/lib/api-types";
import {
  READER_PROGRESS_PERSIST_DEBOUNCE_MS,
  READER_RESUME_PHASE_APPLIED,
  READER_STATUS_READY,
  type ReaderResumePhase,
} from "../../../shared/constants";
import { createLocatorKey } from "../../../shared/utils";
import { writeLocalReaderResumeSnapshot, type ReaderResumeSnapshot } from "@/features/reader/resume";
import { writeProgress } from "@/features/offline/buckets/progress";
import { evaluatePersistEligibility } from "./use-reader-progress-sync.helpers";

type UseLocalProgressSnapshotInput = {
  initialResumePhase: ReaderResumePhase;
  lastServerAckKeyRef: MutableRefObject<string | null>;
  libraryItemId: string;
  payload: ReaderStatusPayload;
  pendingServerLocatorKeyRef: MutableRefObject<string | null>;
  pendingServerLocatorRef: MutableRefObject<ReaderLocator | null>;
  persistPendingProgress: (locator: ReaderLocator, keepalive?: boolean) => Promise<unknown>;
  remotePersistenceEnabled: boolean;
  scheduledPersistTimeoutRef: MutableRefObject<number | null>;
  visibleLocator: ReaderLocator | null;
};

/**
 * Mirrors the current reading position to localStorage/Dexie on every
 * change, then schedules a debounced server save.
 */
export function useLocalProgressSnapshot({
  initialResumePhase,
  lastServerAckKeyRef,
  libraryItemId,
  payload,
  pendingServerLocatorKeyRef,
  pendingServerLocatorRef,
  persistPendingProgress,
  remotePersistenceEnabled,
  scheduledPersistTimeoutRef,
  visibleLocator,
}: UseLocalProgressSnapshotInput) {
  // Cached completionPercent from the current reader payload — extracted so
  // the useEffect dep list below can name a stable value rather than a
  // conditional expression (which the exhaustive-deps lint rejects).
  const readyCompletionPercent =
    payload.status === READER_STATUS_READY
      ? payload.progress.completionPercent
      : 0;

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

    // Phase 4: mirror to Dexie so library cards / book-info / home pick up
    // the latest progress offline. The localStorage write above stays as
    // the fast synchronous path the reader's first-paint resume reads from.
    void writeProgress({
      libraryItemId,
      locator: visibleLocator,
      completionPercent: readyCompletionPercent,
      // Marked dirty pre-emptively; flipped to clean after the server PATCH
      // acks below in the persist flow.
      dirty: true,
    });

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
    lastServerAckKeyRef,
    libraryItemId,
    payload.status,
    pendingServerLocatorKeyRef,
    pendingServerLocatorRef,
    // Captured for the Dexie mirror write — keeps the cached
    // completionPercent in sync with what the reader is rendering.
    readyCompletionPercent,
    persistPendingProgress,
    remotePersistenceEnabled,
    scheduledPersistTimeoutRef,
    visibleLocator,
  ]);
}
