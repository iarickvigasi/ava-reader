import { useCallback, type MutableRefObject } from "react";
import type { ReaderStatusPayload } from "@/lib/api-types";
import { markSessionActive } from "@/features/offline/buckets/sessions";
import { heartbeatReaderSession } from "../../../data/reader-client";
import {
  READER_STATUS_READY,
  READER_VISIBILITY_HIDDEN,
} from "../../../shared/constants";
import type { ReaderControllerAuth } from "../../../shared/types";

type UseSessionHeartbeatInput = ReaderControllerAuth & {
  activeSessionIdRef: MutableRefObject<string | null>;
  clientSessionIdRef: MutableRefObject<string | null>;
  getSessionClientInstanceId: () => string;
  lastActiveAtRef: MutableRefObject<string | null>;
  libraryItemId: string;
  payloadStatus: ReaderStatusPayload["status"];
  remotePersistenceEnabled: boolean;
  restartSessionTrackingRef: MutableRefObject<(() => Promise<unknown>) | null>;
};

/**
 * Pings the server on an interval to keep the active session alive, and
 * restarts tracking if the server tells us it already closed the session.
 */
export function useSessionHeartbeat({
  activeSessionIdRef,
  clientSessionIdRef,
  getSessionClientInstanceId,
  getToken,
  isLoaded,
  isSignedIn,
  lastActiveAtRef,
  libraryItemId,
  payloadStatus,
  remotePersistenceEnabled,
  restartSessionTrackingRef,
}: UseSessionHeartbeatInput) {
  const sendReaderSessionHeartbeat = useCallback(async () => {
    const sessionId = activeSessionIdRef.current;

    if (!remotePersistenceEnabled || !sessionId) {
      return null;
    }

    // Phase 4: always bump the local heartbeat (Dexie). This is what we'll
    // use as `endedAt` if the user's tab dies before a clean stop — the
    // session won't over-count time the user wasn't actually reading.
    const clientSessionId = clientSessionIdRef.current;
    if (clientSessionId) {
      const now = new Date().toISOString();
      lastActiveAtRef.current = now;
      void markSessionActive(clientSessionId, now);
    }

    try {
      const session = await heartbeatReaderSession({
        clientInstanceId: getSessionClientInstanceId(),
        getToken,
        isLoaded,
        isSignedIn,
        libraryItemId,
        sessionId,
      });

      if (
        session.endedAt &&
        payloadStatus === READER_STATUS_READY &&
        typeof document !== "undefined" &&
        document.visibilityState !== READER_VISIBILITY_HIDDEN
      ) {
        activeSessionIdRef.current = null;
        void restartSessionTrackingRef.current?.();
      }

      return session;
    } catch {
      return null;
    }
  }, [
    activeSessionIdRef,
    clientSessionIdRef,
    getSessionClientInstanceId,
    getToken,
    isLoaded,
    isSignedIn,
    lastActiveAtRef,
    libraryItemId,
    payloadStatus,
    remotePersistenceEnabled,
    restartSessionTrackingRef,
  ]);

  return sendReaderSessionHeartbeat;
}
