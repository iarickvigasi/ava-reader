"use client";

// Client side of the generic book-info shell (ADR 4). Slug from
// location.pathname (never useParams — see reader-screen-loader), data from
// Dexie with a one-shot revalidation on miss while online. Freshness on a hit
// is owned by BookInfoHydrator, exactly as on the old SSR page.

import { useOfflineAuth as useAuth } from "@/features/auth/use-offline-auth";
import { useEffect, useRef, useState } from "react";
import { useMountedDeviceOwner } from "@/features/offline/lifecycle/device-owner-context";

import LibraryBookInfoLoading from "./book-info-skeleton";
import { OfflineRouteFallback } from "@/components/app/core/offline-route-fallback";
import { UnavailablePage } from "@/components/app/core/unavailable-page";
import { LibraryBookInfoScreen } from "@/components/app/library/book-info/book-info-screen";
import {
  BookInfoHydrator,
  readBookInfoBySlug,
  readWithRevalidate,
  revalidateBookInfo,
} from "@/features/offline/buckets/library";
import { isOnline } from "@/features/offline/net/net-state";
import { useNetworkState } from "@/features/offline/net/use-network-state";
import type { LibraryBookInfo } from "@/lib/api-types";
import {
  APP_LIBRARY_HREF,
  getCollectionHref,
  slugFromPath,
} from "@/lib/app-routes";

const BOOK_INFO_PATH_PREFIX = "/app/library/books/";
const AUTH_BOOT_TIMEOUT_MS = 2_500;
const AUTH_POLL_INTERVAL_MS = 100;

type LoaderState =
  | { status: "loading" }
  | { status: "ready"; book: LibraryBookInfo; backHref: string }
  | { status: "unavailable" }
  | { status: "notFound" };

export function BookInfoLoader() {
  const { getToken, isLoaded, userId } = useAuth();
  const ownerId = useMountedDeviceOwner();
  const online = useNetworkState();
  const [state, setState] = useState<LoaderState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const wasOffline = useRef(false);
  const authRef = useRef({ getToken, isLoaded, userId });
  useEffect(() => {
    authRef.current = { getToken, isLoaded, userId };
  }, [getToken, isLoaded, userId]);

  useEffect(() => {
    const slug = slugFromPath(window.location.pathname, BOOK_INFO_PATH_PREFIX);
    if (!slug) {
      // The external route, rather than a derived render value, owns this load.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({ status: "notFound" });
      return;
    }
    const fromCollection = new URLSearchParams(window.location.search).get(
      "fromCollection",
    );
    const backHref = fromCollection
      ? getCollectionHref(fromCollection)
      : APP_LIBRARY_HREF;
    let cancelled = false;
    let missing = false;
    let authTimer: ReturnType<typeof setTimeout> | undefined;
    let stopWaiting = () => {};
    const waitForAuthBoot = () =>
      new Promise<void>((resolve) => {
        const startedAt = Date.now();
        const finish = () => {
          clearTimeout(authTimer);
          stopWaiting = () => {};
          resolve();
        };
        stopWaiting = finish;
        const tick = () => {
          if (
            cancelled ||
            authRef.current.isLoaded ||
            Date.now() - startedAt >= AUTH_BOOT_TIMEOUT_MS
          ) {
            finish();
          } else {
            authTimer = setTimeout(tick, AUTH_POLL_INTERVAL_MS);
          }
        };
        tick();
      });
    setState({ status: "loading" });
    void readWithRevalidate({
      isOnline,
      read: () =>
        cancelled ? Promise.resolve(null) : readBookInfoBySlug(slug),
      revalidate: async () => {
        // Cached/offline details do not need Clerk. A network miss must wait
        // for this mounted owner's current authentication, never another owner.
        await waitForAuthBoot();
        const auth = authRef.current;
        if (
          cancelled ||
          !ownerId ||
          !auth.isLoaded ||
          auth.userId !== ownerId
        ) return;
        await revalidateBookInfo(slug, auth.getToken, () => {
          missing = true;
        });
      },
    })
      .then((book) => {
        if (cancelled) {
          return;
        }
        setState(
          book
            ? { status: "ready", book, backHref }
            : { status: missing ? "notFound" : "unavailable" },
        );
      })
      .catch(() => {
        if (!cancelled) setState({ status: "unavailable" });
      });
    return () => {
      cancelled = true;
      stopWaiting();
    };
    // Authentication updates its ref; only an explicit retry or owner change
    // starts a new load, preserving ready details during session refresh.
  }, [attempt, ownerId]);

  // Auto-retry when the connection returns and we have nothing to show.
  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      return;
    }
    if (wasOffline.current && state.status !== "loading") {
      wasOffline.current = false;
      // Reconnect is an external event; keep the existing one-shot recovery.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (state.status === "unavailable") setAttempt((current) => current + 1);
    }
  }, [online, state.status]);

  if (state.status === "loading") {
    return <LibraryBookInfoLoading />;
  }
  if (state.status === "notFound") {
    return <UnavailablePage kind="notFound" />;
  }
  if (state.status === "unavailable") {
    return (
      <OfflineRouteFallback
        routeKey="generic"
        onRetry={() => setAttempt((current) => current + 1)}
      />
    );
  }
  return (
    <>
      {/* Keeps the bucket hydrated + revalidating online, same as before. */}
      <BookInfoHydrator initial={state.book} />
      <LibraryBookInfoScreen backHref={state.backHref} book={state.book} />
    </>
  );
}
