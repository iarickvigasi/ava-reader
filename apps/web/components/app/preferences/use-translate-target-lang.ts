"use client";

import { TRANSLATE_LANGUAGES } from "@/components/app/reader/overlays/ai-toolbox/translate-languages";
import { usePreference } from "./use-preference";

// SSR-safe fallback used when navigator detection isn't available or
// returns nothing recognizable. English maximizes the chance the user can
// at least read the UI label until they pick their real preference.
export const DEFAULT_TRANSLATE_TARGET_LANG = "English";

const STORAGE_KEY = "ava.reader.translateTargetLang";

const SUPPORTED_NAMES = new Set(TRANSLATE_LANGUAGES.map((l) => l.value));

// Primary subtags whose Intl.DisplayNames result is more specific than the
// generic name we ship in the translate list (e.g. "Norwegian Bokmål" vs
// "Norwegian"). Chinese is handled separately because the distinction we
// ship is script-based, not language-based.
const PRIMARY_OVERRIDES: Record<string, string> = {
  nb: "Norwegian",
  nn: "Norwegian",
};

function parseTargetLang(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function detectTargetLang(): string | null {
  if (typeof navigator === "undefined") return null;
  const tag = navigator.language;
  if (!tag) return null;

  const lower = tag.toLowerCase();
  if (lower.startsWith("zh")) {
    const isTraditional =
      lower.includes("hant") ||
      lower.includes("-tw") ||
      lower.includes("-hk") ||
      lower.includes("-mo");
    return isTraditional ? "Chinese (Traditional)" : "Chinese (Simplified)";
  }

  const primary = tag.split("-")[0]?.toLowerCase();
  if (!primary) return null;
  const override = PRIMARY_OVERRIDES[primary];
  if (override) return override;

  try {
    const display = new Intl.DisplayNames(["en"], { type: "language" });
    const name = display.of(primary);
    if (name && SUPPORTED_NAMES.has(name)) return name;
  } catch {
    // Intl.DisplayNames not available — give up and fall back.
  }

  return null;
}

export function useTranslateTargetLang(): [string, (next: string) => void] {
  return usePreference({
    field: "translateTargetLang",
    storageKey: STORAGE_KEY,
    defaultValue: DEFAULT_TRANSLATE_TARGET_LANG,
    parse: parseTargetLang,
    getClientDefault: detectTargetLang,
  });
}
