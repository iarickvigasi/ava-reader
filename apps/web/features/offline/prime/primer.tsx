"use client";

// Client island that kicks off the background cache primer. Mounted in AppShell
// so it runs on the first load of ANY /app route — a fresh device may enter via
// a deep link (a book, the library), not home. It schedules
// `primeAllCaches` during idle time, supplying the Clerk-authenticated fetchers
// the book-content tier needs, and surfaces the Save-Data consent modal when
// the content tier is blocked waiting for the user's answer.
//
// A module-level guard makes the initial kick-off run at most once per page
// lifetime, so React strict-mode's double-invoke doesn't start two passes.
// `primeAllCaches` is itself idempotent, so this is belt and braces.

import { useAuth } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { emitAppToast } from "@/components/app/core/app-toast";
import { fetchReaderPayload } from "@/components/app/reader/reader-screen/data/reader-client";

import { getDb } from "../db";
import { saveBookOffline } from "../buckets/book/download";
import { getPrimeProgress, setPrimeProgress } from "../status/prime-progress";
import { useNetworkState } from "../net/use-network-state";

import {
  CONTENT_CONSENT_GRANTED,
  META_KEY_CONTENT_CONSENT,
  setMetaFlag,
} from "./meta";
import { primeAllCaches } from "./prime-all";
import { PrimeConsentModal } from "./prime-consent-modal";
import type { SaveBookFn } from "./types";

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

export function BackgroundPrimer(): React.ReactElement | null {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const online = useNetworkState();
  const t = useTranslations("offline.toast");
  const [consentOpen, setConsentOpen] = useState(false);

  // Saves one book's full content offline. Explicit kind → sticky, so a
  // proactively-cached book isn't auto-evicted the moment the user opens a
  // different one. Quota is enforced by the primer before each call.
  const saveBook: SaveBookFn = useCallback(
    (libraryItemId) =>
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
      }),
    [getToken, isLoaded, isSignedIn],
  );

  const run = useCallback(async () => {
    getDb();
    const result = await primeAllCaches({
      getToken,
      saveBook,
      onStorageFull: () =>
        emitAppToast({ message: t("quotaLow"), tone: "warning" }),
      onProgress: (done, total) => setPrimeProgress({ done, total }),
    });
    // A full pass leaves {total,total} for the header chip's done-dwell to show,
    // then it auto-hides. A pass that ended early (offline / user took over /
    // storage floor) would otherwise leave a stuck partial chip — clear it.
    const final = getPrimeProgress();
    if (!final || final.done < final.total) {
      setPrimeProgress(null);
    }
    if (result.contentConsentNeeded) {
      setConsentOpen(true);
    }
  }, [getToken, saveBook, t]);

  useEffect(() => {
    if (kickedOff || !isLoaded || !isSignedIn || !online) {
      return;
    }
    kickedOff = true;
    scheduleIdle(() => void run());
  }, [isLoaded, isSignedIn, online, run]);

  if (!consentOpen) {
    return null;
  }

  return (
    <PrimeConsentModal
      onConfirm={() => {
        setConsentOpen(false);
        void (async () => {
          await setMetaFlag(META_KEY_CONTENT_CONSENT, CONTENT_CONSENT_GRANTED);
          await run();
        })();
      }}
      onCancel={() => {
        // Not persisted — we re-offer next session (Save-Data may be off by
        // then, or the user may decide differently).
        setConsentOpen(false);
      }}
    />
  );
}
