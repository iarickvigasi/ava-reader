import { useEffect, type MutableRefObject } from "react";
import type { ReaderStatusPayload } from "@/lib/api-types";
import { syncPendingSessions } from "@/features/offline/buckets/sessions";
import {
  READER_STATUS_READY,
  READER_VISIBILITY_HIDDEN,
} from "../../../shared/constants";
import type { ReaderControllerAuth } from "../../../shared/types";

type UseSessionVisibilitySyncInput = ReaderControllerAuth & {
  getSessionClientInstanceId: () => string;
  payloadStatus: ReaderStatusPayload["status"];
  remotePersistenceEnabled: boolean;
  restartSessionTrackingRef: MutableRefObject<(() => Promise<unknown>) | null>;
  startReaderSessionTracking: () => Promise<unknown>;
  stopReaderSessionTracking: (keepalive?: boolean) => Promise<unknown>;
};

/**
 * Wires session start/stop to tab visibility, page unload, and reconnect —
 * the "when" layer on top of use-start-session/use-stop-session's "how".
 */
export function useSessionVisibilitySync({
  getSessionClientInstanceId,
  getToken,
  isLoaded,
  isSignedIn,
  payloadStatus,
  remotePersistenceEnabled,
  restartSessionTrackingRef,
  startReaderSessionTracking,
  stopReaderSessionTracking,
}: UseSessionVisibilitySyncInput) {
  useEffect(() => {
    restartSessionTrackingRef.current = startReaderSessionTracking;

    return () => {
      if (restartSessionTrackingRef.current === startReaderSessionTracking) {
        restartSessionTrackingRef.current = null;
      }
    };
  }, [restartSessionTrackingRef, startReaderSessionTracking]);

  useEffect(() => {
    if (!remotePersistenceEnabled || payloadStatus !== READER_STATUS_READY) {
      return;
    }

    void startReaderSessionTracking();
  }, [payloadStatus, remotePersistenceEnabled, startReaderSessionTracking]);

  useEffect(() => {
    if (!remotePersistenceEnabled) {
      return;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === READER_VISIBILITY_HIDDEN) {
        void stopReaderSessionTracking(true);
        return;
      }

      if (payloadStatus === READER_STATUS_READY) {
        void startReaderSessionTracking();
      }
    };

    const handlePageHide = () => {
      void stopReaderSessionTracking(true);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [
    payloadStatus,
    remotePersistenceEnabled,
    startReaderSessionTracking,
    stopReaderSessionTracking,
  ]);

  useEffect(() => {
    return () => {
      void stopReaderSessionTracking(true);
    };
  }, [stopReaderSessionTracking]);

  // Phase 4 sync trigger: drain queued (closed but unsynced) sessions on
  // every online/visibility flip. Cheap when the queue is empty — one
  // Dexie scan. We pass the reader's clientInstanceId so the replayed
  // sessions land under the same participant on the server.
  useEffect(() => {
    if (!remotePersistenceEnabled || !isLoaded || !isSignedIn) {
      return;
    }
    const tryDrain = () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        return;
      }
      void syncPendingSessions(getToken, getSessionClientInstanceId());
    };
    tryDrain();
    const onVisible = () => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState !== READER_VISIBILITY_HIDDEN
      ) {
        tryDrain();
      }
    };
    window.addEventListener("online", tryDrain);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", tryDrain);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [
    getSessionClientInstanceId,
    getToken,
    isLoaded,
    isSignedIn,
    remotePersistenceEnabled,
  ]);
}
