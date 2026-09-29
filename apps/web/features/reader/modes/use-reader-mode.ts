"use client";

import { useCallback, useState, useSyncExternalStore } from "react";

const STORAGE_PREFIX = "ava.reader.mode:";
const subscribeToHydration = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function useReaderMode(bookPath: string | null): [boolean, () => void] {
  const storageKey = bookPath
    ? `${STORAGE_PREFIX}${bookPath.replace(/\/$/, "")}`
    : null;
  const [mode, setMode] = useState(() => ({
    storageKey,
    isBilingual: readMode(storageKey),
  }));
  const isBilingual =
    mode.storageKey === storageKey ? mode.isBilingual : readMode(storageKey);
  if (mode.storageKey !== storageKey) {
    setMode({ storageKey, isBilingual });
  }
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    getClientSnapshot,
    getServerSnapshot,
  );
  const toggle = useCallback(() => {
    if (!storageKey) return;
    const next = !isBilingual;
    setMode({ storageKey, isBilingual: next });
    try {
      window.localStorage.setItem(storageKey, next ? "bilingual" : "plain");
    } catch {
      // Keep session toggling available when browser storage is unavailable.
    }
  }, [isBilingual, storageKey]);

  return [hydrated && isBilingual, toggle];
}

function readMode(storageKey: string | null): boolean {
  if (!storageKey || typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(storageKey) === "bilingual";
  } catch {
    return false;
  }
}
