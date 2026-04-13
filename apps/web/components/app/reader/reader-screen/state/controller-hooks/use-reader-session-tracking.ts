import { useCallback, useEffect, useRef } from "react";
import type { ReaderSessionPayload, ReaderStatusPayload } from "@/lib/api-types";
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

      if (!remotePersistenceEnabled || !sessionId) {
        return null;
      }

      try {
        return await stopReaderSession({
          clientInstanceId: getSessionClientInstanceId(),
          getToken,
          isLoaded,
          isSignedIn,
          keepalive,
          libraryItemId,
          sessionId,
        });
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

    try {
      const session = await startReaderSession({
        clientInstanceId: getSessionClientInstanceId(),
        getToken,
        isLoaded,
        isSignedIn,
        libraryItemId,
        signal: controller.signal,
      });

      if (controller.signal.aborted) {
        return null;
      }

      sessionStartAbortRef.current = null;

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
}
