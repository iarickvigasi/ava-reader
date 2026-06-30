"use client";

// Client island that kicks off the background cache primer. Mounted in AppShell
// so it runs on the first load of ANY /app route — a fresh device may enter via
// a deep link, not home. It schedules `primeAllCaches` during idle time with the
// Clerk-authenticated fetchers the content tier needs, and surfaces the Save-Data
// consent modal when that tier is blocked on the user's answer.
//
// The kick-off fires when we first come online and again on every reconnect —
// a save requested while offline must download once the connection returns. A
// module-level `running` guard prevents overlapping passes (it doesn't latch).

import { useAuth } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

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
import { scheduleIdle } from "./schedule-idle";
import { reduceKick } from "./trigger";
import type { SaveBookFn } from "./types";

let running = false;

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
    if (running) {
      return;
    }
    running = true;
    try {
      getDb();
      const result = await primeAllCaches({
        getToken,
        saveBook,
        onStorageFull: () =>
          emitAppToast({ message: t("quotaLow"), tone: "warning" }),
        onProgress: (progress) => setPrimeProgress(progress),
      });
      // A completed pass leaves `{ phase: "ready" }` for the chip's done-dwell
      // to show, then auto-hides. Any other leftover (a partial metadata/content
      // count from a pass that ended early — offline, blocked on consent, user
      // took over) would otherwise stick, so clear it.
      const final = getPrimeProgress();
      if (final?.phase !== "ready") {
        setPrimeProgress(null);
      }
      if (result.contentConsentNeeded) {
        setConsentOpen(true);
      }
    } finally {
      running = false;
    }
  }, [getToken, saveBook, t]);

  // Re-kick on each offline→online transition (not just the first online
  // render); a redundant kick is a cheap no-op via `running` + idempotency.
  // The `wasOnline` edge only advances once auth is ready — see reduceKick.
  const lastOnlineRef = useRef(false);
  useEffect(() => {
    const { lastOnline, kick } = reduceKick(lastOnlineRef.current, {
      isLoaded,
      isSignedIn,
      online,
    });
    lastOnlineRef.current = lastOnline;
    if (kick) {
      scheduleIdle(() => void run());
    }
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
