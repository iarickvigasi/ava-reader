"use client";

// Global modal mounted once in <AppShell>. Listens for
// `ava-reader:missing-book` window events and renders an instructional
// dialog explaining how to save the book offline. Two trigger points fire
// it today:
//
//   1. ReadBookLink wrapper — intercepts clicks on any "open the reader"
//      link when the user is offline AND the book isn't cached, so the
//      user never sees an empty reader render before being told.
//   2. BookContextProvider — emits on the reader page itself for the
//      hard-refresh / direct-URL case where the page loads first and the
//      cache check resolves to "missing-offline".

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  MISSING_BOOK_EVENT,
  type MissingBookEventDetail,
} from "@/features/offline/missing-book-bus";

export function MissingBookOfflineModal() {
  // Open state is keyed by libraryItemId so a fresh emit for a different
  // book replaces the current one rather than queueing.
  const [openFor, setOpenFor] = useState<string | null>(null);
  const t = useTranslations("offline.missingBook");

  useEffect(() => {
    const handle = (event: Event) => {
      const detail = (event as CustomEvent<MissingBookEventDetail>).detail;
      if (!detail?.libraryItemId) {
        return;
      }
      setOpenFor(detail.libraryItemId);
    };
    window.addEventListener(MISSING_BOOK_EVENT, handle);
    return () => {
      window.removeEventListener(MISSING_BOOK_EVENT, handle);
    };
  }, []);

  if (!openFor) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="missing-book-offline-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4 backdrop-blur-sm"
      onClick={() => setOpenFor(null)}
    >
      <div
        className="relative w-full max-w-lg rounded-modal bg-paper p-6 shadow-(--shadow-card)"
        onClick={(event) => event.stopPropagation()}
      >
        <h2
          id="missing-book-offline-title"
          className="font-reader text-[1.75rem] leading-[1.1] text-title"
        >
          {t("title")}
        </h2>
        <p className="mt-4 text-base leading-7 text-copy">{t("body")}</p>
        <div className="mt-6 flex justify-end">
          <Button type="button" size="sm" onClick={() => setOpenFor(null)}>
            {t("dismiss")}
          </Button>
        </div>
      </div>
    </div>
  );
}
