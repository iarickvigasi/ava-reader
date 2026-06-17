"use client";

import { useAuth } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import { type ComponentProps, useCallback, useEffect, useState } from "react";

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
import { DotPulseIcon } from "./dot-pulse-icon";
import { resolveOfflineCard } from "./resolve-offline-card";

// Save-for-offline card. The variant is chosen by `resolveOfflineCard` from
// durable Dexie state — crucially "queued" derives from the synced
// `offlineRequested` intent (not transient component state), so a request made
// offline survives navigation and the background primer finishes the download
// on reconnect (see specs/12-offline-save-sync, specs/13-offline-save-button).
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
  const { state: offlineState, fromAutoSave, offlineRequested, refresh } =
    useBookOfflineState(libraryItemId, snapshot.status);
  // True only while we tear down an in-flight download the user tapped to cancel.
  const [aborting, setAborting] = useState(false);

  const isDownloading = snapshot.status === "saving";
  const kind = resolveOfflineCard({
    aborting,
    isDownloading,
    offlineState,
    fromAutoSave,
    offlineRequested,
  });

  // Record the synced intent and refresh so the card flips to "queued" at once;
  // the effect below (and the background primer) do the actual download.
  const requestSave = useCallback(() => {
    void setBookOfflineIntent(libraryItemId, true, getToken).then(refresh);
  }, [libraryItemId, getToken, refresh]);

  // Cancel a queued request: clear the synced intent so no device downloads it.
  const cancelSave = useCallback(() => {
    void setBookOfflineIntent(libraryItemId, false, getToken).then(refresh);
  }, [libraryItemId, getToken, refresh]);

  // Abort an in-flight download: clear intent, show a brief "cancelling" state
  // while the orchestrator tears down its partial rows, then drop back to idle.
  const abortSave = useCallback(() => {
    setAborting(true);
    void setBookOfflineIntent(libraryItemId, false, getToken);
    void cancel().finally(() => {
      setAborting(false);
      refresh();
    });
  }, [libraryItemId, getToken, cancel, refresh]);

  // Promote an auto-saved (evictable) book to a sticky explicit save — content
  // is already on disk, so this is an instant flag flip, no download.
  const keepOffline = useCallback(() => {
    void promoteBookOffline(libraryItemId, getToken).then(refresh);
  }, [libraryItemId, getToken, refresh]);

  // Stop keeping an auto-saved book offline: flag-only change that does NOT
  // delete the cached content — it becomes an evictable auto-cache again.
  const releaseOffline = useCallback(() => {
    void releaseBookOffline(libraryItemId, getToken).then(refresh);
  }, [libraryItemId, getToken, refresh]);

  // Remove an explicit download: clear the synced intent first (so the primer /
  // other devices stop re-downloading), then delete the cached content.
  const removeDownload = useCallback(async () => {
    await setBookOfflineIntent(libraryItemId, false, getToken);
    await remove();
    refresh();
  }, [libraryItemId, getToken, remove, refresh]);

  // A queued request downloads as soon as we're online and on this page; the
  // background primer is the page-independent safety net for when we are not.
  useEffect(() => {
    if (kind !== "queued" || !online) {
      return;
    }
    void save("explicit").then((outcome) => {
      if (outcome.kind === "saved") {
        refresh();
      }
    });
  }, [kind, online, save, refresh]);

  const props = ((): ComponentProps<typeof ActionCard> => {
    switch (kind) {
      case "aborting":
        return {
          icon: DotPulseIcon,
          title: t("aborting.title"),
          description: t("aborting.description"),
          disabled: true,
        };
      case "downloading":
        return {
          icon: DotPulseIcon,
          title: t("downloading.title"),
          description: t("downloading.description", {
            current: snapshot.currentChapters,
            total: snapshot.totalChapters,
          }),
          onClick: abortSave,
        };
      case "saved":
        return {
          icon: ReaderDownloadIcon,
          title: t("saved.title"),
          description: t("saved.description"),
          onClick: releaseOffline,
        };
      case "remove":
        return {
          icon: ReaderDownloadIcon,
          title: t("remove.title"),
          description: t("remove.description"),
          onClick: () => void removeDownload(),
        };
      case "queued":
        return {
          icon: ReaderDownloadIcon,
          title: t("pending.title"),
          description: t("pending.description"),
          onClick: cancelSave,
        };
      case "keep":
        return {
          icon: ReaderDownloadIcon,
          title: t("keep.title"),
          description: t("keep.description"),
          onClick: keepOffline,
        };
      default:
        return {
          icon: ReaderDownloadIcon,
          title: t("idle.title"),
          description: t("idle.description"),
          onClick: requestSave,
          disabled: offlineState === "loading",
        };
    }
  })();

  return <ActionCard {...props} />;
}
