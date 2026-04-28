import { useCallback, useEffect, useState } from "react";

// Phase 1 storage for the target translation language. We park it in
// localStorage rather than persisting on the user record so the AI Comments
// feature can ship without a new backend endpoint. The bilingual preferences
// section can switch over to a real /preferences API later without touching
// callers — they only see `useTranslateTargetLang`.

const STORAGE_KEY = "ava.reader.translateTargetLang";

// The default mirrors the BilingualSection's static "French" placeholder so
// there's no behavioral surprise on first load.
export const DEFAULT_TRANSLATE_TARGET_LANG = "French";

type Listener = (value: string) => void;
const listeners = new Set<Listener>();

function readStoredValue(): string {
  if (typeof window === "undefined") {
    return DEFAULT_TRANSLATE_TARGET_LANG;
  }
  try {
    return (
      window.localStorage.getItem(STORAGE_KEY) ?? DEFAULT_TRANSLATE_TARGET_LANG
    );
  } catch {
    return DEFAULT_TRANSLATE_TARGET_LANG;
  }
}

function writeStoredValue(value: string) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // If localStorage is unavailable (private browsing on some platforms),
    // we silently degrade to in-memory only.
  }
}

// All hook instances share a single in-process listener bus so updates from
// one consumer (e.g. the preferences screen) propagate to others (e.g. the
// AI Comments panel) without prop drilling.
export function useTranslateTargetLang(): [
  string,
  (next: string) => void,
] {
  const [value, setValue] = useState<string>(readStoredValue);

  useEffect(() => {
    const listener: Listener = (next) => {
      setValue(next);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const update = useCallback((next: string) => {
    const trimmed = next.trim();
    if (!trimmed) {
      return;
    }
    writeStoredValue(trimmed);
    setValue(trimmed);
    listeners.forEach((listener) => listener(trimmed));
  }, []);

  return [value, update];
}
