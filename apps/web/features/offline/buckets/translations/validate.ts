import {
  BILINGUAL_TRANSLATION_VERSION,
  type BilingualChapter,
  type BilingualTranslations,
} from "@/lib/api-types/bilingual";

import { sameTranslationIdentity } from "./selectors";
import type { TranslationScope } from "./types";

export function validateTranslationChapter(
  value: unknown,
  scope: TranslationScope,
): BilingualChapter {
  const chapter = requireRecord(value);
  if (
    chapter.libraryItemId !== scope.libraryItemId ||
    chapter.chapterId !== scope.chapterId ||
    chapter.targetLang !== scope.targetLang ||
    chapter.translationVersion !== BILINGUAL_TRANSLATION_VERSION ||
    typeof chapter.contentRevision !== "string" ||
    !Array.isArray(chapter.units)
  )
    invalid();
  const seen = new Set<string>();
  const sentenceIds = new Set<string>();
  for (const entry of chapter.units) {
    const unit = requireRecord(entry);
    if (
      typeof unit.id !== "string" ||
      !unit.id ||
      seen.has(unit.id) ||
      typeof unit.blockId !== "string" ||
      typeof unit.text !== "string" ||
      (unit.itemId !== undefined && typeof unit.itemId !== "string") ||
      typeof unit.startOffset !== "number" ||
      !Number.isInteger(unit.startOffset) ||
      typeof unit.endOffset !== "number" ||
      !Number.isInteger(unit.endOffset) ||
      unit.startOffset < 0 ||
      unit.endOffset < unit.startOffset ||
      (unit.kind !== "sentence" && unit.kind !== "image")
    )
      invalid();
    seen.add(unit.id);
    if (unit.kind === "sentence") sentenceIds.add(unit.id);
  }
  validateTranslations(chapter.translations, sentenceIds);
  return chapter as BilingualChapter;
}

export function validateGeneratedTranslations(
  value: unknown,
  chapter: BilingualChapter,
  requested: string[],
): BilingualTranslations {
  const result = value as BilingualTranslations;
  if (!result || !sameTranslationIdentity(result, chapter)) invalid();
  validateTranslations(result.translations, new Set(requested));
  if (requested.some((id) => !result.translations[id])) invalid();
  return result;
}

function validateTranslations(value: unknown, allowed: Set<string>): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
  for (const [id, text] of Object.entries(value)) {
    if (!allowed.has(id) || typeof text !== "string" || !text.trim()) invalid();
  }
}

function invalid(): never {
  throw new Error("The translation response did not match this chapter.");
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
  return value as Record<string, unknown>;
}
