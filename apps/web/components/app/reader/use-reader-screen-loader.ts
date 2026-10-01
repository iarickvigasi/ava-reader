"use client";

import { useOfflineAuth as useAuth } from "@/features/auth/use-offline-auth";
import { useEffect, useRef, useState } from "react";

import { fetchReaderPayload } from "@/components/app/reader/data/reader-client";
import { loadReaderPayloadFromCache } from "@/features/offline/buckets/book";
import { emitMissingBookOfflineModal } from "@/features/offline/notices/missing-book-bus";
import {
  isOnline,
  subscribeToNetworkState,
} from "@/features/offline/net/net-state";
import {
  loadReaderForSlug,
  type ReaderLoadResult,
} from "@/features/reader/load-reader-for-slug";
import { resolveCachedLibraryItemId } from "@/features/reader/resolve-cached-library-item-id";
import { slugFromPath } from "@/lib/app-routes";

const READER_PATH_PREFIX = "/app/read/";
const AUTH_BOOT_TIMEOUT_MS = 2_500;
const AUTH_POLL_INTERVAL_MS = 100;

export function useReaderScreenLoader() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [result, setResult] = useState<ReaderLoadResult | null>(null);
  const [attempt, setAttempt] = useState(0);
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
        return { kind: "not-found" };
      }
      return loadReaderForSlug(slug, {
        isOnline,
        findLibraryItemIdBySlug: resolveCachedLibraryItemId,
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

  useEffect(() => {
    if (result?.kind === "missing-offline" && result.libraryItemId) {
      emitMissingBookOfflineModal({ libraryItemId: result.libraryItemId });
    }
  }, [result]);

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

  return result;
}
