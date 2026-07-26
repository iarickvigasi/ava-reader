import { useCallback, type MutableRefObject } from "react";
import { closeLocalSession, markSessionSynced } from "@/features/offline/buckets/sessions";
import { stopReaderSession } from "../../../data/reader-client";
import type { ReaderControllerAuth } from "../../../shared/types";

type UseStopSessionInput = ReaderControllerAuth & {
  activeSessionIdRef: MutableRefObject<string | null>;
  clientSessionIdRef: MutableRefObject<string | null>;
  getSessionClientInstanceId: () => string;
  lastActiveAtRef: MutableRefObject<string | null>;
  libraryItemId: string;
  remotePersistenceEnabled: boolean;
  sessionHeartbeatIntervalRef: MutableRefObject<number | null>;
  sessionStartAbortRef: MutableRefObject<AbortController | null>;
  sessionStartedAtRef: MutableRefObject<string | null>;
};

/**
 * Closes the active reading session locally (always) and on the server
 * (when remote persistence is on), used on tab-hide, unmount, and close.
 */
export function useStopSession({
  activeSessionIdRef,
  clientSessionIdRef,
  getSessionClientInstanceId,
  getToken,
  isLoaded,
  isSignedIn,
  lastActiveAtRef,
  libraryItemId,
  remotePersistenceEnabled,
  sessionHeartbeatIntervalRef,
  sessionStartAbortRef,
  sessionStartedAtRef,
}: UseStopSessionInput) {
  const stopReaderSessionTracking = useCallback(
    async (keepalive = false) => {
      if (sessionHeartbeatIntervalRef.current !== null) {
        window.clearInterval(sessionHeartbeatIntervalRef.current);
        sessionHeartbeatIntervalRef.current = null;
      }

      sessionStartAbortRef.current?.abort();
      sessionStartAbortRef.current = null;

      const sessionId = activeSessionIdRef.current;
      activeSessionIdRef.current = null;

      // Phase 4: close the local row first. The endedAt is always the last
      // heartbeat we recorded — using "now" here would over-count time when
      // the user was already away (e.g. tab hidden then this fires later).
      const clientSessionId = clientSessionIdRef.current;
      clientSessionIdRef.current = null;
      const endedAt = lastActiveAtRef.current ?? new Date().toISOString();
      lastActiveAtRef.current = null;
      sessionStartedAtRef.current = null;
      if (clientSessionId) {
        void closeLocalSession({ clientSessionId, endedAt });
      }

      if (!remotePersistenceEnabled || !sessionId) {
        return null;
      }

      try {
        const result = await stopReaderSession({
          clientInstanceId: getSessionClientInstanceId(),
          getToken,
          isLoaded,
          isSignedIn,
          keepalive,
          libraryItemId,
          sessionId,
        });
        // Server acked the stop. Mark the local row synced so the sync
        // runner doesn't replay it. On any thrown / non-ok path we fall
        // through to the catch — the row stays unsynced and the runner
        // replays it when the connection comes back.
        if (clientSessionId) {
          void markSessionSynced({
            clientSessionId,
            serverSessionId: sessionId,
            syncedAt: new Date().toISOString(),
          });
        }
        return result;
      } catch {
        return null;
      }
    },
    [
      activeSessionIdRef,
      clientSessionIdRef,
      getSessionClientInstanceId,
      getToken,
      isLoaded,
      isSignedIn,
      lastActiveAtRef,
      libraryItemId,
      remotePersistenceEnabled,
      sessionHeartbeatIntervalRef,
      sessionStartAbortRef,
      sessionStartedAtRef,
    ],
  );

  return stopReaderSessionTracking;
}
