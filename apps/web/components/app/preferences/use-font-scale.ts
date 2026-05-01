"use client";

import { usePreference } from "./use-preference";

export const DEFAULT_FONT_SCALE = 1;
export const MIN_FONT_SCALE = 0.85;
export const MAX_FONT_SCALE = 1.35;

const STORAGE_KEY = "ava.reader.fontScale";

function parseFontScale(raw: unknown): number | null {
  const value = typeof raw === "number" ? raw : Number.parseFloat(String(raw));
  if (!Number.isFinite(value)) return null;
  if (value < MIN_FONT_SCALE || value > MAX_FONT_SCALE) return null;
  return value;
}

export function useFontScale(): [number, (next: number) => void] {
  return usePreference({
    field: "fontScale",
    storageKey: STORAGE_KEY,
    defaultValue: DEFAULT_FONT_SCALE,
    parse: parseFontScale,
  });
}
