"use client";

import { usePreference } from "./use-preference";

// Reserved for future i18n. The web UI is English-only today, so this
// simply exposes the persisted value when callers ask for it.

export const DEFAULT_INTERFACE_LANG = "en";

const STORAGE_KEY = "ava.interfaceLang";

function parseInterfaceLang(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length < 2 || trimmed.length > 16) return null;
  return trimmed;
}

export function useInterfaceLang(): [string, (next: string) => void] {
  return usePreference({
    field: "interfaceLang",
    storageKey: STORAGE_KEY,
    defaultValue: DEFAULT_INTERFACE_LANG,
    parse: parseInterfaceLang,
  });
}
