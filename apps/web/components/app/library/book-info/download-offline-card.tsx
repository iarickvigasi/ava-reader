"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { ReaderDownloadIcon } from "@/components/app/shared/app-icons";
import {
  hasBookContent,
  useBookSaveStatus,
  useSaveBook,
} from "@/features/offline/buckets/book";

import { ActionCard } from "./action-card";

// Save-for-offline card. State machine:
//   idle        → "Save for offline" / "Read this book when there is no
//                  connection". Click: start an explicit save.
//   downloading → "Saving for offline" / "{current} / {total} chapters".
//                  3-dot pulse replaces the icon; the card stays disabled.
//   saved       → "Remove from downloads" / "Book will be still available
//                  online". Click: open confirm dialog → remove on confirm.
export function DownloadOfflineCard({
  libraryItemId,
}: {
  libraryItemId: string;
}) {
  const t = useTranslations("library.bookInfo.saveForOffline");
  const snapshot = useBookSaveStatus(libraryItemId);
  const { save, remove } = useSaveBook(libraryItemId);
  const isSaved = useIsBookSaved(libraryItemId, snapshot.status);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const isDownloading = snapshot.status === "saving";
  const isReady =
    !isDownloading && (isSaved === true || snapshot.status === "saved");

  if (isDownloading) {
    return (
      <ActionCard
        icon={DotPulseIcon}
        title={t("downloading.title")}
        description={t("downloading.description", {
          current: snapshot.currentChapters,
          total: snapshot.totalChapters,
        })}
        disabled
      />
    );
  }

  if (isReady) {
    return (
      <>
        <ActionCard
          icon={ReaderDownloadIcon}
          title={t("saved.title")}
          description={t("saved.description")}
          onClick={() => setConfirmOpen(true)}
        />
        {confirmOpen ? (
          <RemoveConfirmDialog
            onConfirm={async () => {
              setConfirmOpen(false);
              await remove();
            }}
            onCancel={() => setConfirmOpen(false)}
          />
        ) : null}
      </>
    );
  }

  return (
    <ActionCard
      icon={ReaderDownloadIcon}
      title={t("idle.title")}
      description={t("idle.description")}
      onClick={() => void save("explicit")}
      disabled={isSaved === null}
    />
  );
}

// Returns true/false once Dexie resolves, null while pending. Re-queries
// whenever the in-memory save status changes so completion + removal both
// propagate without a manual subscription.
function useIsBookSaved(libraryItemId: string, saveStatus: string) {
  const [isSaved, setIsSaved] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    void hasBookContent(libraryItemId).then((present) => {
      if (!cancelled) {
        setIsSaved(present);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [libraryItemId, saveStatus]);
  return isSaved;
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

function RemoveConfirmDialog({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("library.bookInfo.saveForOffline.confirm");
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="action-card-confirm-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="relative w-full max-w-md rounded-3xl bg-paper p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2
          id="action-card-confirm-title"
          className="font-reader text-[1.5rem] leading-[1.15] text-title"
        >
          {t("title")}
        </h2>
        <p className="mt-3 text-base leading-7 text-copy">{t("body")}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-11 items-center rounded-pl border border-line px-4 text-sm font-semibold uppercase tracking-[0.14em] text-ink transition hover:bg-paper-strong"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex h-11 items-center rounded-pl bg-brand-fill px-5 text-sm font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-brand-fill-strong"
          >
            {t("confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
