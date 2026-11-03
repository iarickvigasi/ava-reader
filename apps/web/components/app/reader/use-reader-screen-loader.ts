"use client";

import { useOfflineAuth as useAuth } from "@/features/auth/use-offline-auth";
import { useEffect, useRef, useState } from "react";

import { emitMissingBookOfflineModal } from "@/features/offline/notices/missing-book-bus";
import { subscribeToNetworkState } from "@/features/offline/net/net-state";
import type { ReaderLoadResult } from "@/features/reader/load-reader-for-slug";
import { loadReaderScreen } from "@/features/reader/load-reader-screen";

export function useReaderScreenLoader() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [result, setResult] = useState<ReaderLoadResult | null>(null);
  const [attempt, setAttempt] = useState(0);
  const hasPayload = result?.kind === "loaded";
  // Auth updates must not restart an already-open reader.
  const authRef = useRef({ getToken, isLoaded, isSignedIn });
  useEffect(
    function refreshAuthSnapshot() {
      authRef.current = { getToken, isLoaded, isSignedIn };
    },
    [getToken, isLoaded, isSignedIn],
  );

  useEffect(
    function openReader() {
      // Recovery may already be queued when the first payload arrives.
      if (hasPayload) return;
      const controller = new AbortController();
      const { signal } = controller;
      void loadReaderScreen({
        pathname: window.location.pathname,
        readAuth: () => authRef.current,
        signal,
      }).then(
        (next) => {
          if (!signal.aborted) setResult(next);
        },
        () => {
          if (!signal.aborted) setResult({ kind: "error" });
        },
      );
      return () => controller.abort();
    },
    [attempt, hasPayload],
  );

  useEffect(
    function notifyMissingBook() {
      if (result?.kind === "missing-offline" && result.libraryItemId) {
        emitMissingBookOfflineModal({ libraryItemId: result.libraryItemId });
      }
    },
    [result],
  );

  useEffect(
    function retryOpeningOnRecovery() {
      if (hasPayload) return;
      return subscribeToNetworkState((nextOnline) => {
        if (nextOnline) setAttempt((current) => current + 1);
      });
    },
    [hasPayload],
  );

  return result;
}
