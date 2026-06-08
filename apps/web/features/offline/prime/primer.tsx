"use client";

// Client island that kicks off the background cache primer on home load.
// Rendered once, on the home page, alongside the home hydrator. It does no
// rendering — it just schedules `primeAllCaches` during idle time, supplying
// the Clerk-authenticated fetchers the book-content tier needs.
//
// A module-level guard makes the kick-off run at most once per page lifetime,
// so React strict-mode's double-invoke (and any incidental remount) doesn't
// start two passes. `primeAllCaches` is itself idempotent, so this is belt and
// braces.

import { useAuth } from "@clerk/nextjs";
import { useEffect } from "react";

import { fetchReaderPayload } from "@/components/app/reader/reader-screen/data/reader-client";

import { getDb } from "../db";
import { saveBookOffline } from "../buckets/book/download";
import { useNetworkState } from "../use-network-state";

import { primeAllCaches, type SaveBookFn } from "./prime-all";

let kickedOff = false;

function scheduleIdle(run: () => void): void {
  const ric = (
    globalThis as typeof globalThis & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    }
  ).requestIdleCallback;
  if (typeof ric === "function") {
    ric(run, { timeout: 5_000 });
  } else {
    setTimeout(run, 1_500);
  }
}

export function BackgroundPrimer(): null {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const online = useNetworkState();

  useEffect(() => {
    if (kickedOff || !isLoaded || !isSignedIn || !online) {
      return;
    }
    kickedOff = true;

    // Saves one book's full content offline. Explicit kind → sticky, so a
    // proactively-cached book isn't auto-evicted the moment the user opens a
    // different one. Quota is enforced by the primer before each call.
    const saveBook: SaveBookFn = (libraryItemId) =>
      saveBookOffline({
        libraryItemId,
        saveKind: "explicit",
        fetchChapter: (id, chapterId, signal) =>
          fetchReaderPayload({
            getToken,
            isLoaded,
            isSignedIn,
            libraryItemId: id,
            chapterId,
            signal,
          }),
        fetchCover: async (url, signal) => {
          try {
            const response = await fetch(url, { signal });
            return response.ok ? await response.blob() : null;
          } catch {
            return null;
          }
        },
      });

    scheduleIdle(() => {
      // Touch the db once up front so the singleton is initialised on the
      // same tick the primer starts reading/writing.
      getDb();
      void primeAllCaches({ getToken, saveBook });
    });
  }, [getToken, isLoaded, isSignedIn, online]);

  return null;
}
