"use client";

import { usePreference } from "./use-preference";

export const DEFAULT_TRANSLATE_TARGET_LANG = "French";

const STORAGE_KEY = "ava.reader.translateTargetLang";

function parseTargetLang(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function useTranslateTargetLang(): [string, (next: string) => void] {
  return usePreference({
    field: "translateTargetLang",
    storageKey: STORAGE_KEY,
    defaultValue: DEFAULT_TRANSLATE_TARGET_LANG,
    parse: parseTargetLang,
  });
}
