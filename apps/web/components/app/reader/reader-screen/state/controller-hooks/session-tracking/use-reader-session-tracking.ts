import { useCallback, useEffect, useRef } from "react";
import type { ReaderStatusPayload } from "@/lib/api-types";
import { getOrCreateReaderClientInstanceId } from "../../../data/reader-client";
import type { ReaderControllerAuth } from "../../../shared/types";
import { useSessionHeartbeat } from "./use-session-heartbeat";
import { useStopSession } from "./use-stop-session";
import { useStartSession } from "./use-start-session";
import { useSessionVisibilitySync } from "./use-session-visibility-sync";

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
  const restartSessionTrackingRef = useRef<(() => Promise<unknown>) | null>(null);

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

  const sendReaderSessionHeartbeat = useSessionHeartbeat({
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
  });

  const stopReaderSessionTracking = useStopSession({
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
  });

  const startReaderSessionTracking = useStartSession({
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
  });

  useSessionVisibilitySync({
    getSessionClientInstanceId,
    getToken,
    isLoaded,
    isSignedIn,
    payloadStatus,
    remotePersistenceEnabled,
    restartSessionTrackingRef,
    startReaderSessionTracking,
    stopReaderSessionTracking,
  });
}
