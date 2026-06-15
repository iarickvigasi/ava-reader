"use client";

// Client side of the generic book-info shell (ADR 4). Slug from
// location.pathname (never useParams — see reader-screen-loader), data from
// Dexie with a one-shot revalidation on miss while online. Freshness on a hit
// is owned by BookInfoHydrator, exactly as on the old SSR page.

import { useAuth } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";

import LibraryBookInfoLoading from "@/app/app/library/books/[slug]/loading";
import { OfflineRouteFallback } from "@/components/app/core/offline-route-fallback";
import { LibraryBookInfoScreen } from "@/components/app/library/book-info/book-info-screen";
import {
  BookInfoHydrator,
  revalidateBookInfo,
} from "@/features/offline/buckets/library";
import { readBookInfoBySlug } from "@/features/offline/buckets/library/storage";
import { readWithRevalidate } from "@/features/offline/buckets/library/read-with-revalidate";
import { isOnline } from "@/features/offline/net-state";
import { useNetworkState } from "@/features/offline/use-network-state";
import type { LibraryBookInfo } from "@/lib/api-types";
import { APP_LIBRARY_HREF, getCollectionHref, slugFromPath } from "@/lib/app-routes";

const BOOK_INFO_PATH_PREFIX = "/app/library/books/";

type LoaderState =
  | { status: "loading" }
  | { status: "ready"; book: LibraryBookInfo; backHref: string }
  | { status: "unavailable" };

export function BookInfoLoader() {
  const { getToken } = useAuth();
  const online = useNetworkState();
  const [state, setState] = useState<LoaderState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const wasOffline = useRef(false);

  useEffect(() => {
    const slug = slugFromPath(window.location.pathname, BOOK_INFO_PATH_PREFIX);
    if (!slug) {
      setState({ status: "unavailable" });
      return;
    }
    const fromCollection = new URLSearchParams(window.location.search).get(
      "fromCollection",
    );
    const backHref = fromCollection
      ? getCollectionHref(fromCollection)
      : APP_LIBRARY_HREF;
    let cancelled = false;
    setState({ status: "loading" });
    void readWithRevalidate({
      isOnline,
      read: () => readBookInfoBySlug(slug),
      revalidate: () => revalidateBookInfo(slug, getToken),
    }).then((book) => {
      if (cancelled) {
        return;
      }
      setState(
        book ? { status: "ready", book, backHref } : { status: "unavailable" },
      );
    });
    return () => {
      cancelled = true;
    };
    // getToken's identity is deliberately not a dep; `attempt` drives reruns.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  // Auto-retry when the connection returns and we have nothing to show.
  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      return;
    }
    if (wasOffline.current) {
      wasOffline.current = false;
      setAttempt((current) => current + 1);
    }
  }, [online]);

  if (state.status === "loading") {
    return <LibraryBookInfoLoading />;
  }
  if (state.status === "unavailable") {
    return <OfflineRouteFallback routeKey="generic" />;
  }
  return (
    <>
      {/* Keeps the bucket hydrated + revalidating online, same as before. */}
      <BookInfoHydrator initial={state.book} />
      <LibraryBookInfoScreen backHref={state.backHref} book={state.book} />
    </>
  );
}
