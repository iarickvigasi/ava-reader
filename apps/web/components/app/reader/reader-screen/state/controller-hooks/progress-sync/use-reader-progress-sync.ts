import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import type { ReaderLocator, ReaderStatusPayload } from "@/lib/api-types";
import type { ReaderControllerAuth } from "../../../shared/types";
import type { ReaderResumePhase } from "../../../shared/constants";
import { createLocatorKey } from "../../../shared/utils";
import { usePersistServerProgress } from "./use-persist-server-progress";
import { useLocalProgressSnapshot } from "./use-local-progress-snapshot";
import { useProgressFlushOnHide } from "./use-progress-flush-on-hide";

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

  const persistPendingProgress = usePersistServerProgress({
    getToken,
    isLoaded,
    isSignedIn,
    lastServerAckKeyRef,
    libraryItemId,
    pendingServerLocatorKeyRef,
    pendingServerLocatorRef,
    remotePersistenceEnabled,
    setPayload,
  });

  useLocalProgressSnapshot({
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
  });

  useProgressFlushOnHide({
    initialResumePhase,
    lastServerAckKeyRef,
    payload,
    pendingServerLocatorKeyRef,
    pendingServerLocatorRef,
    persistPendingProgress,
    remotePersistenceEnabled,
    scheduledPersistTimeoutRef,
  });
}
