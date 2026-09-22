import type { BilingualChapter } from "@/lib/api-types/bilingual";

import type { AvaReaderDB } from "../../db";
import { translationKey } from "./id";
import type { TranslationScope } from "./types";

export async function readTranslationChapter(
  db: AvaReaderDB,
  scope: TranslationScope,
) {
  const row = await db.translations.get(translationKey(scope));
  if (!row) return null;
  const {
    libraryItemId,
    chapterId,
    contentRevision,
    translationVersion,
    targetLang,
    units,
    translations,
  } = row;
  return {
    libraryItemId,
    chapterId,
    contentRevision,
    translationVersion,
    targetLang,
    units,
    translations,
  };
}

export async function writeTranslationChapter(
  db: AvaReaderDB,
  chapter: BilingualChapter,
) {
  await db.translations.put({
    ...chapter,
    fetchedAt: new Date().toISOString(),
  });
}
