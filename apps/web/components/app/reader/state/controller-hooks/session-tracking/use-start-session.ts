import { useCallback, type MutableRefObject } from "react";
import type {
  ReaderSessionPayload,
  ReaderStatusPayload,
} from "@/lib/api-types";
import {
  beginLocalSession,
  markSessionSynced,
} from "@/features/offline/buckets/sessions";
import { startReaderSession } from "../../../data/reader-client";
import {
  READER_SESSION_HEARTBEAT_INTERVAL_MS,
  READER_STATUS_READY,
  READER_VISIBILITY_HIDDEN,
} from "../../../shared/constants";
import type { ReaderControllerAuth } from "../../../shared/types";

type UseStartSessionInput = ReaderControllerAuth & {
  activeSessionIdRef: MutableRefObject<string | null>;
  clientSessionIdRef: MutableRefObject<string | null>;
  getSessionClientInstanceId: () => string;
  lastActiveAtRef: MutableRefObject<string | null>;
  libraryItemId: string;
  payloadStatus: ReaderStatusPayload["status"];
  remotePersistenceEnabled: boolean;
  sendReaderSessionHeartbeat: () => Promise<ReaderSessionPayload | null>;
  sessionHeartbeatIntervalRef: MutableRefObject<number | null>;
  sessionStartAbortRef: MutableRefObject<AbortController | null>;
  sessionStartedAtRef: MutableRefObject<string | null>;
  stopReaderSessionTracking: (keepalive?: boolean) => Promise<unknown>;
};

/**
 * Opens a new reading session (local-first, then server) when the book is
 * ready and the tab is visible, and arms the heartbeat interval.
 */
export function useStartSession({
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
  sendReaderSessionHeartbeat,
  sessionHeartbeatIntervalRef,
  sessionStartAbortRef,
  sessionStartedAtRef,
  stopReaderSessionTracking,
}: UseStartSessionInput) {
  const startReaderSessionTracking = useCallback(async () => {
    if (
      !remotePersistenceEnabled ||
      payloadStatus !== READER_STATUS_READY ||
      typeof document === "undefined" ||
      document.visibilityState === READER_VISIBILITY_HIDDEN ||
      activeSessionIdRef.current ||
      sessionStartAbortRef.current
    ) {
      return null;
    }

    const controller = new AbortController();
    sessionStartAbortRef.current = controller;

    const { clientSessionId, startedAt, timeZone } =
      beginLocalSession(libraryItemId);
    clientSessionIdRef.current = clientSessionId;
    sessionStartedAtRef.current = startedAt;
    lastActiveAtRef.current = startedAt;

    try {
      const session = await startReaderSession({
        clientInstanceId: getSessionClientInstanceId(),
        clientSessionId,
        getToken,
        isLoaded,
        isSignedIn,
        libraryItemId,
        signal: controller.signal,
        startedAt,
        timeZone,
      });

      if (controller.signal.aborted) {
        return null;
      }

      sessionStartAbortRef.current = null;

      // Server acked the open. Mark the local row synced so the runner
      // doesn't post a duplicate replay on the next online tick.
      void markSessionSynced({
        clientSessionId,
        serverSessionId: session.sessionId,
        syncedAt: new Date().toISOString(),
      });

      if (document.hidden) {
        activeSessionIdRef.current = session.sessionId;
        await stopReaderSessionTracking(true);
        return null;
      }

      activeSessionIdRef.current = session.sessionId;

      if (sessionHeartbeatIntervalRef.current !== null) {
        window.clearInterval(sessionHeartbeatIntervalRef.current);
      }

      sessionHeartbeatIntervalRef.current = window.setInterval(() => {
        void sendReaderSessionHeartbeat();
      }, READER_SESSION_HEARTBEAT_INTERVAL_MS);

      return session;
    } catch {
      sessionStartAbortRef.current = null;
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
    sendReaderSessionHeartbeat,
    sessionHeartbeatIntervalRef,
    sessionStartAbortRef,
    sessionStartedAtRef,
    stopReaderSessionTracking,
  ]);

  return startReaderSessionTracking;
}
