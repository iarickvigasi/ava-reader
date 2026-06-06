import { useCallback, useEffect, useRef } from "react";
import type { ReaderSessionPayload, ReaderStatusPayload } from "@/lib/api-types";
import {
  closeLocalSession,
  createLocalSession,
  generateClientSessionId,
  markSessionActive,
  markSessionSynced,
  syncPendingSessions,
} from "@/features/offline/buckets/sessions";
import {
  getOrCreateReaderClientInstanceId,
  heartbeatReaderSession,
  startReaderSession,
  stopReaderSession,
} from "../../data/reader-client";
import {
  READER_SESSION_HEARTBEAT_INTERVAL_MS,
  READER_STATUS_READY,
  READER_VISIBILITY_HIDDEN,
} from "../../shared/constants";
import type { ReaderControllerAuth } from "../../shared/types";

type UseReaderSessionTrackingInput = ReaderControllerAuth & {
  libraryItemId: string;
  payloadStatus: ReaderStatusPayload["status"];
  remotePersistenceEnabled: boolean;
};

export function useReaderSessionTracking({
  getToken,
  isLoaded,
  isSignedIn,
  libraryItemId,
  payloadStatus,
  remotePersistenceEnabled,
}: UseReaderSessionTrackingInput) {
  const activeSessionIdRef = useRef<string | null>(null);
  // Phase 4: stable client-generated id for the current session. Written to
  // Dexie as soon as the session begins (before the server call) so even an
  // offline session has a durable row that the sync runner can replay later.
  const clientSessionIdRef = useRef<string | null>(null);
  const sessionStartedAtRef = useRef<string | null>(null);
  const lastActiveAtRef = useRef<string | null>(null);
  const sessionClientInstanceIdRef = useRef<string | null>(null);
  const sessionHeartbeatIntervalRef = useRef<number | null>(null);
  const sessionStartAbortRef = useRef<AbortController | null>(null);
  const restartSessionTrackingRef = useRef<
    (() => Promise<ReaderSessionPayload | null>) | null
  >(null);

  const getSessionClientInstanceId = useCallback(() => {
    if (sessionClientInstanceIdRef.current) {
      return sessionClientInstanceIdRef.current;
    }

    const clientInstanceId = getOrCreateReaderClientInstanceId();
    sessionClientInstanceIdRef.current = clientInstanceId;
    return clientInstanceId;
  }, []);

  useEffect(() => {
    if (sessionClientInstanceIdRef.current) {
      return;
    }

    sessionClientInstanceIdRef.current = getOrCreateReaderClientInstanceId();
  }, []);

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
    getSessionClientInstanceId,
    getToken,
    isLoaded,
    isSignedIn,
    libraryItemId,
    payloadStatus,
    remotePersistenceEnabled,
  ]);

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
      getSessionClientInstanceId,
      getToken,
      isLoaded,
      isSignedIn,
      libraryItemId,
      remotePersistenceEnabled,
    ],
  );

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

    // Phase 4: write the session locally before talking to the server.
    // Even if the network is dead, this row exists and the sync runner
    // will replay it on reconnect (as a single POST with startedAt +
    // endedAt) so reading hours stay accurate.
    const clientSessionId = generateClientSessionId();
    const startedAt = new Date().toISOString();
    clientSessionIdRef.current = clientSessionId;
    sessionStartedAtRef.current = startedAt;
    lastActiveAtRef.current = startedAt;
    void createLocalSession({
      clientSessionId,
      libraryItemId,
      startedAt,
    });

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
    getSessionClientInstanceId,
    getToken,
    isLoaded,
    isSignedIn,
    libraryItemId,
    payloadStatus,
    remotePersistenceEnabled,
    sendReaderSessionHeartbeat,
    stopReaderSessionTracking,
  ]);

  useEffect(() => {
    restartSessionTrackingRef.current = startReaderSessionTracking;

    return () => {
      if (restartSessionTrackingRef.current === startReaderSessionTracking) {
        restartSessionTrackingRef.current = null;
      }
    };
  }, [startReaderSessionTracking]);

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
