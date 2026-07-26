"use client";

// Client side of the generic reader shell (ADR 4). Derives the slug from
// location.pathname (never useParams — a fallback-served shell's baked params
// can belong to a different slug), resolves the payload Dexie-first via
// loadReaderForSlug, and renders the reader / skeleton / offline fallback.

import { useAuth } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";

import { OfflineRouteFallback } from "@/components/app/core/offline-route-fallback";
import { ReaderScreen } from "@/components/app/reader/reader-screen";
import { ReaderShellSkeleton } from "@/components/app/reader/reader-shell-skeleton";
import { fetchReaderPayload } from "@/components/app/reader/data/reader-client";
import { loadReaderPayloadFromCache } from "@/features/offline/buckets/book";
import { readLibraryItemIdBySlug } from "@/features/offline/buckets/library/storage";
import { emitMissingBookOfflineModal } from "@/features/offline/notices/missing-book-bus";
import { isOnline, subscribeToNetworkState } from "@/features/offline/net/net-state";
import {
  loadReaderForSlug,
  type ReaderLoadResult,
} from "@/features/reader/load-reader-for-slug";
import { slugFromPath } from "@/lib/app-routes";

const READER_PATH_PREFIX = "/app/read/";
// How long the network step waits for Clerk to boot before fetching anyway.
// Online, Clerk loads well within this; offline it never loads, the fetch
// fails, and the failure maps to the missing-book modal instead of a spinner.
const AUTH_BOOT_TIMEOUT_MS = 2_500;
const AUTH_POLL_INTERVAL_MS = 100;

export function ReaderScreenLoader() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [result, setResult] = useState<ReaderLoadResult | null>(null);
  const [attempt, setAttempt] = useState(0);
  // Latest auth state for the fetch wrapper, without re-running the load
  // effect (Dexie hits must resolve instantly, before Clerk is ready). Synced
  // in an effect (not during render) and declared before the load effect so
  // it updates first; the in-flight auth wait polls it.
  const authRef = useRef({ getToken, isLoaded, isSignedIn });
  useEffect(() => {
    authRef.current = { getToken, isLoaded, isSignedIn };
  }, [getToken, isLoaded, isSignedIn]);

  useEffect(() => {
    let cancelled = false;
    const waitForAuthBoot = () =>
      new Promise<void>((resolve) => {
        const startedAt = Date.now();
        const tick = () => {
          if (
            authRef.current.isLoaded ||
            Date.now() - startedAt >= AUTH_BOOT_TIMEOUT_MS
          ) {
            resolve();
          } else {
            setTimeout(tick, AUTH_POLL_INTERVAL_MS);
          }
        };
        tick();
      });
    const load = async (): Promise<ReaderLoadResult> => {
      const slug = slugFromPath(window.location.pathname, READER_PATH_PREFIX);
      if (!slug) {
        return { kind: "error" };
      }
      return loadReaderForSlug(slug, {
        isOnline,
        findLibraryItemIdBySlug: readLibraryItemIdBySlug,
        loadFromCache: loadReaderPayloadFromCache,
        fetchFromNetwork: async (slugOrId) => {
          await waitForAuthBoot();
          return fetchReaderPayload({
            ...authRef.current,
            libraryItemId: slugOrId,
          });
        },
      });
    };
    void load().then((next) => {
      if (!cancelled) {
        setResult(next);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  // The content isn't on this device — surface the existing instructional
  // modal (same one the ReadBookLink intercept uses).
  useEffect(() => {
    if (result?.kind === "missing-offline" && result.libraryItemId) {
      emitMissingBookOfflineModal({ libraryItemId: result.libraryItemId });
    }
  }, [result]);

  // Auto-retry when the connection returns: subscribe to net-state transitions
  // (the sanctioned external-system pattern) and bump the attempt counter on
  // each offline → online flip.
  useEffect(() => {
    let wasOffline = !isOnline();
    return subscribeToNetworkState((nextOnline) => {
      if (!nextOnline) {
        wasOffline = true;
        return;
      }
      if (wasOffline) {
        wasOffline = false;
        setAttempt((current) => current + 1);
      }
    });
  }, []);

  if (result?.kind === "loaded") {
    return (
      <ReaderScreen
        initialPayload={result.payload}
        libraryItemId={result.libraryItemId}
      />
    );
  }
  if (!result) {
    return <ReaderShellSkeleton />;
  }
  return <OfflineRouteFallback routeKey="generic" />;
}
