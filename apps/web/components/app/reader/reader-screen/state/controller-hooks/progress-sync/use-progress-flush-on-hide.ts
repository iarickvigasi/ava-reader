import { useEffect, type MutableRefObject } from "react";
import type { ReaderLocator, ReaderStatusPayload } from "@/lib/api-types";
import {
  READER_RESUME_PHASE_APPLIED,
  READER_STATUS_READY,
  READER_VISIBILITY_HIDDEN,
  type ReaderResumePhase,
} from "../../../shared/constants";
import { shouldFlushPendingProgress } from "./use-reader-progress-sync.helpers";

type UseProgressFlushOnHideInput = {
  initialResumePhase: ReaderResumePhase;
  lastServerAckKeyRef: MutableRefObject<string | null>;
  payload: ReaderStatusPayload;
  pendingServerLocatorKeyRef: MutableRefObject<string | null>;
  pendingServerLocatorRef: MutableRefObject<ReaderLocator | null>;
  persistPendingProgress: (locator: ReaderLocator, keepalive?: boolean) => Promise<unknown>;
  remotePersistenceEnabled: boolean;
  scheduledPersistTimeoutRef: MutableRefObject<number | null>;
};

/**
 * Flushes any not-yet-persisted position immediately when the tab is hidden
 * or closed, instead of waiting for the debounce timer.
 */
export function useProgressFlushOnHide({
  initialResumePhase,
  lastServerAckKeyRef,
  payload,
  pendingServerLocatorKeyRef,
  pendingServerLocatorRef,
  persistPendingProgress,
  remotePersistenceEnabled,
  scheduledPersistTimeoutRef,
}: UseProgressFlushOnHideInput) {
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
    lastServerAckKeyRef,
    payload.status,
    pendingServerLocatorKeyRef,
    pendingServerLocatorRef,
    persistPendingProgress,
    remotePersistenceEnabled,
    scheduledPersistTimeoutRef,
  ]);
}
