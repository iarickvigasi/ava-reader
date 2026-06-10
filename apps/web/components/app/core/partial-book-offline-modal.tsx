"use client";

// Global modal mounted once in <AppShell> (reader branch, beside the missing-
// book modal). Listens for `ava-reader:partial-book` events fired by the reader
// when a book is opened offline with only some chapters cached, and offers to
// save the whole book. See [[15-partial-offline-notice]].

import { useAuth } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { setBookOfflineIntent } from "@/features/offline/buckets/library";
import {
  PARTIAL_BOOK_EVENT,
  type PartialBookEventDetail,
} from "@/features/offline/partial-book-bus";

export function PartialBookOfflineModal() {
  const [detail, setDetail] = useState<PartialBookEventDetail | null>(null);
  // Books dismissed this session — a re-emit (re-opening the same book) won't
  // nag again. Reset on a hard reload, which is a fresh session.
  const dismissedRef = useRef<Set<string>>(new Set());
  const t = useTranslations("offline.partialBook");
  const { getToken } = useAuth();

  useEffect(() => {
    const handle = (event: Event) => {
      const next = (event as CustomEvent<PartialBookEventDetail>).detail;
      if (!next?.libraryItemId || dismissedRef.current.has(next.libraryItemId)) {
        return;
      }
      setDetail(next);
    };
    window.addEventListener(PARTIAL_BOOK_EVENT, handle);
    return () => {
      window.removeEventListener(PARTIAL_BOOK_EVENT, handle);
    };
  }, []);

  if (!detail) {
    return null;
  }

  const dismiss = () => {
    dismissedRef.current.add(detail.libraryItemId);
    setDetail(null);
  };

  // Offline-safe: records the synced "keep offline" intent (queued, syncs +
  // resumes the download on reconnect via the primer — see [[12-offline-save-sync]]).
  const saveOffline = () => {
    void setBookOfflineIntent(detail.libraryItemId, true, getToken);
    dismiss();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="partial-book-offline-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4 backdrop-blur-sm"
      onClick={dismiss}
    >
      <div
        className="relative w-full max-w-lg rounded-3xl bg-paper p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2
          id="partial-book-offline-title"
          className="font-reader text-[1.75rem] leading-[1.1] text-title"
        >
          {t("title", {
            cached: detail.cachedChapterCount,
            total: detail.totalChapterCount,
          })}
        </h2>
        <p className="mt-4 text-base leading-7 text-copy">{t("body")}</p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={dismiss}
            className="inline-flex h-11 items-center justify-center rounded-pl border border-line px-5 text-sm font-semibold uppercase tracking-[0.14em] text-ink transition hover:bg-paper-strong"
          >
            {t("dismiss")}
          </button>
          <button
            type="button"
            onClick={saveOffline}
            className="inline-flex h-11 items-center justify-center rounded-pl bg-brand-fill px-5 text-sm font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-brand-fill-strong"
          >
            {t("save")}
          </button>
        </div>
      </div>
    </div>
  );
}
