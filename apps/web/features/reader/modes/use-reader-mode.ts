"use client";

import { useCallback, useState, useSyncExternalStore } from "react";

const STORAGE_KEY = "ava.reader.mode";
const subscribeToHydration = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function useReaderMode(): [boolean, () => void] {
  const [isBilingual, setIsBilingual] = useState(readMode);
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    getClientSnapshot,
    getServerSnapshot,
  );
  const toggle = useCallback(() => {
    const next = !isBilingual;
    setIsBilingual(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "bilingual" : "plain");
    } catch {
      // Keep session toggling available when browser storage is unavailable.
    }
  }, [isBilingual]);

  return [hydrated && isBilingual, toggle];
}

function readMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "bilingual";
  } catch {
    return false;
  }
}
