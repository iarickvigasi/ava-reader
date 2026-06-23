"use client";

// BookContext is the reader-page-level integration point for offline book
// storage. It:
//   1. checks Dexie on mount to see whether the current book has been saved
//      (BookRow + at least the first chapter on disk),
//   2. when missing AND online, kicks off an auto-save in the background so
//      future offline reads work,
//   3. when missing AND offline, surfaces a "missing-offline" status so the
//      reader can render the explanatory modal,
//   4. tracks save progress (currentChapters / totalChapters) for any UI
//      that wants to show "Downloading 14 / 38".
//
// Actual chapter loading is handled by the reader's normal data flow — the
// `fetchReaderPayload` helper is cache-first, so once Dexie has the book,
// every chapter read comes from there for free.

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { emitMissingBookOfflineModal } from "@/features/offline/notices/missing-book-bus";
import { useNetworkState } from "@/features/offline/net/use-network-state";

import { useBookSaveStatus, useSaveBook } from "./hooks";
import { hasBookContent } from "./storage";
import { useEvictStaleAutoSaves } from "./use-evict-stale-auto-saves";

export type BookContextStatus =
  | "hydrating" // Dexie check in flight
  | "ready" // book is in Dexie OR initial payload is enough for now
  | "saving" // auto-save in progress
  | "missing-offline" // not in Dexie and currently offline
  | "failed"; // save attempt failed (user can retry via going back online)

type BookContextValue = {
  libraryItemId: string;
  status: BookContextStatus;
  // 0..total progress from the save bucket. Only meaningful while saving.
  currentChapters: number;
  totalChapters: number;
};

const Ctx = createContext<BookContextValue | null>(null);

export function useBookContext(): BookContextValue {
  const value = useContext(Ctx);
  if (!value) {
    // Renderers outside the reader don't need the context; return a safe
    // default rather than throwing so library / book-info components can
    // optionally read save status without crashing.
    return {
      libraryItemId: "",
      status: "ready",
      currentChapters: 0,
      totalChapters: 0,
    };
  }
  return value;
}

export function BookContextProvider({
  libraryItemId,
  children,
}: {
  libraryItemId: string;
  children: ReactNode;
}) {
  const online = useNetworkState();
  const saveSnapshot = useBookSaveStatus(libraryItemId);
  const { save } = useSaveBook(libraryItemId);

  const [hasCached, setHasCached] = useState<boolean | null>(null);

  // Initial cache check. Re-runs when the bucket status flips to "saved"
  // (a sibling component triggered the save), so we transition out of
  // hydrating without an extra mount.
  useEffect(() => {
    let cancelled = false;
    void hasBookContent(libraryItemId).then((present) => {
      if (!cancelled) {
        setHasCached(present);
      }
    });
    return () => {
      cancelled = true;
    };
    // Re-check when the save bucket says we just finished saving — that's
    // exactly the moment hasBookContent flips to true.
  }, [libraryItemId, saveSnapshot.status]);

  // Auto-save trigger: missing in cache AND online AND not already saving.
  // Fire-and-forget — the orchestrator drives status through the bucket.
  useEffect(() => {
    if (hasCached !== false) {
      return;
    }
    if (!online) {
      return;
    }
    if (
      saveSnapshot.status === "saving" ||
      saveSnapshot.status === "saved"
    ) {
      return;
    }
    void save("auto");
  }, [hasCached, online, saveSnapshot.status, save]);

  // Opening this book evicts every *other* auto-cache. Gated on online + this
  // book being cached so we never strand the user mid-download and an offline
  // switch waits for reconnect; the open book is exempt. See ./evict.
  useEvictStaleAutoSaves(libraryItemId, online && hasCached === true);

  const status = deriveStatus({
    hasCached,
    online,
    saveStatus: saveSnapshot.status,
  });

  // Bridge to the globally-mounted modal. ReadBookLink intercepts most
  // navigations before they ever reach the reader, but a hard refresh
  // or a direct-URL visit lands here without going through that gate —
  // emit on transition into "missing-offline" to cover that case.
  useEffect(() => {
    if (status === "missing-offline") {
      emitMissingBookOfflineModal({ libraryItemId });
    }
  }, [status, libraryItemId]);

  const value: BookContextValue = {
    libraryItemId,
    status,
    currentChapters: saveSnapshot.currentChapters,
    totalChapters: saveSnapshot.totalChapters,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// Pure function so it's trivially testable.
export function deriveStatus(input: {
  hasCached: boolean | null;
  online: boolean;
  saveStatus: ReturnType<typeof useBookSaveStatus>["status"];
}): BookContextStatus {
  if (input.hasCached === null) {
    return "hydrating";
  }
  if (input.hasCached) {
    return "ready";
  }
  // Not cached. Are we mid-download?
  if (input.saveStatus === "saving") {
    return "saving";
  }
  if (input.saveStatus === "failed") {
    return "failed";
  }
  // Not cached, not saving. Online means we'll start a save (and effectively
  // move to "saving" momentarily). Offline means we can't and the modal
  // should explain why.
  return input.online ? "saving" : "missing-offline";
}

