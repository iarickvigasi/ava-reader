"use client";

import { useAuth } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { ReaderDownloadIcon } from "@/components/app/shared/app-icons";
import {
  useBookOfflineState,
  useBookSaveStatus,
  useSaveBook,
} from "@/features/offline/buckets/book";
import {
  promoteBookOffline,
  releaseBookOffline,
  setBookOfflineIntent,
} from "@/features/offline/buckets/library";
import { useNetworkState } from "@/features/offline/net/use-network-state";

import { ActionCard } from "./action-card";

// Save-for-offline card. State machine:
//   idle        → "Save for offline". Click: start an explicit save.
//   queued      → "Download queued" when the request was made offline. Click:
//                  cancel.
//   downloading → "Saving for offline" / progress. Click: abort.
//   aborting    → "Cancelling download" while teardown runs.
//   auto-saved  → "Keep for offline": cached implicitly while reading and
//                  evictable. Click: promote to a sticky explicit save.
//   kept        → explicit save. Two flavours by origin:
//                  • auto-saved then kept → "Saved offline"; click releases it
//                    (flag-only, content kept) back to "Keep for offline".
//                  • downloaded explicitly → "Remove from downloads"; click
//                    deletes the content and returns to "Save for offline".
export function DownloadOfflineCard({
  libraryItemId,
}: {
  libraryItemId: string;
}) {
  const t = useTranslations("library.bookInfo.saveForOffline");
  const { getToken } = useAuth();
  const online = useNetworkState();
  const snapshot = useBookSaveStatus(libraryItemId);
  const { save, remove, cancel } = useSaveBook(libraryItemId);
  const {
    state: offlineState,
    fromAutoSave,
    refresh,
  } = useBookOfflineState(libraryItemId, snapshot.status);
  // True between the moment the user asks to save and the content actually
  // landing. Lets us resume the download when the connection returns if the
  // request was made offline (the intent itself is already queued + synced).
  const [pendingSave, setPendingSave] = useState(false);
  // True while we tear down an in-flight download the user tapped to cancel.
  const [aborting, setAborting] = useState(false);

  const isDownloading = snapshot.status === "saving";
  const isExplicit = offlineState === "explicit";

  // Record the synced intent immediately (so the choice follows the user to
  // other devices and survives offline), then let the effect below perform the
  // actual content download once we're online.
  const requestSave = useCallback(() => {
    void setBookOfflineIntent(libraryItemId, true, getToken);
    setPendingSave(true);
  }, [libraryItemId, getToken]);

  // Tapping the queued card cancels the request: clear the synced intent (so no
  // device downloads it) and drop back to the idle state. Nothing downloads.
  const cancelSave = useCallback(() => {
    setPendingSave(false);
    void setBookOfflineIntent(libraryItemId, false, getToken);
  }, [libraryItemId, getToken]);

  // Tapping a download in progress aborts it: clear the synced intent, show a
  // brief "cancelling" state while the orchestrator tears down its partial
  // rows, then fall back to the standard idle card.
  const abortSave = useCallback(() => {
    setAborting(true);
    setPendingSave(false);
    void setBookOfflineIntent(libraryItemId, false, getToken);
    void cancel().finally(() => setAborting(false));
  }, [libraryItemId, getToken, cancel]);

  // Promote an auto-saved (evictable) book to a sticky explicit save. Content
  // is already on disk, so this is an instant flag flip — no download.
  const keepOffline = useCallback(() => {
    void promoteBookOffline(libraryItemId, getToken).then(() => refresh());
  }, [libraryItemId, getToken, refresh]);

  // Stop keeping an auto-saved book offline: a flag-only change (clears the
  // synced intent + stickiness) that does NOT delete the cached content — it
  // just becomes an evictable auto-cache again. Card → "Keep for offline".
  const releaseOffline = useCallback(() => {
    void releaseBookOffline(libraryItemId, getToken).then(() => refresh());
  }, [libraryItemId, getToken, refresh]);

  // Remove an explicitly-downloaded book: clear the synced intent (so the primer
  // / other devices stop re-downloading it), then delete the cached content to
  // free space. Card → "Save for offline". Await the intent write first so the
  // deletion sees the cleared flag.
  const removeDownload = useCallback(async () => {
    await setBookOfflineIntent(libraryItemId, false, getToken);
    await remove();
    refresh();
  }, [libraryItemId, getToken, remove, refresh]);

  useEffect(() => {
    if (!pendingSave || !online || isDownloading || isExplicit) {
      return;
    }
    void save("explicit").then((outcome) => {
      if (outcome.kind === "saved") {
        setPendingSave(false);
      }
    });
  }, [pendingSave, online, isDownloading, isExplicit, save]);

  if (aborting) {
    return (
      <ActionCard
        icon={DotPulseIcon}
        title={t("aborting.title")}
        description={t("aborting.description")}
        disabled
      />
    );
  }

  if (isDownloading) {
    return (
      <ActionCard
        icon={DotPulseIcon}
        title={t("downloading.title")}
        description={t("downloading.description", {
          current: snapshot.currentChapters,
          total: snapshot.totalChapters,
        })}
        onClick={abortSave}
      />
    );
  }

  // Explicitly kept offline. Two flavours, by origin:
  //  - auto-saved then kept → "Saved offline": releasing keeps the content
  //    (flag-only) and drops to "Keep for offline".
  //  - downloaded from scratch → "Remove from downloads": deletes the content
  //    and drops to "Save for offline".
  if (isExplicit) {
    return fromAutoSave ? (
      <ActionCard
        icon={ReaderDownloadIcon}
        title={t("saved.title")}
        description={t("saved.description")}
        onClick={releaseOffline}
      />
    ) : (
      <ActionCard
        icon={ReaderDownloadIcon}
        title={t("remove.title")}
        description={t("remove.description")}
        onClick={() => void removeDownload()}
      />
    );
  }

  // Requested but not yet downloaded — typically because the request was made
  // offline. Tapping cancels. Checked before the auto/idle branches so a queued
  // save shows its real state.
  if (pendingSave) {
    return (
      <ActionCard
        icon={ReaderDownloadIcon}
        title={t("pending.title")}
        description={t("pending.description")}
        onClick={cancelSave}
      />
    );
  }

  // Cached implicitly while reading (the evictable auto-save slot) → let the
  // user keep it permanently.
  if (offlineState === "auto") {
    return (
      <ActionCard
        icon={ReaderDownloadIcon}
        title={t("keep.title")}
        description={t("keep.description")}
        onClick={keepOffline}
      />
    );
  }

  // Not cached (or still resolving) → offer a fresh save.
  return (
    <ActionCard
      icon={ReaderDownloadIcon}
      title={t("idle.title")}
      description={t("idle.description")}
      onClick={requestSave}
      disabled={offlineState === "loading"}
    />
  );
}

// Three-dot pulse used as the icon while a save is in flight. Keyframe
// `ava-dot-pulse` is declared in globals.css.
function DotPulseIcon() {
  return (
    <span
      aria-hidden
      className="inline-flex items-center gap-1"
      style={{ height: "1.125rem" }}
    >
      {[0, 0.18, 0.36].map((delay) => (
        <span
          key={delay}
          className="inline-block size-1 rounded-full bg-current"
          style={{
            animation: `ava-dot-pulse 1.4s ease-in-out ${delay}s infinite`,
          }}
        />
      ))}
    </span>
  );
}

