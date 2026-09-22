import type {
  BilingualChapter,
  BilingualIdentity,
} from "@/lib/api-types/bilingual";

export function sameTranslationIdentity(
  left: BilingualIdentity,
  right: BilingualIdentity,
): boolean {
  return (
    left.libraryItemId === right.libraryItemId &&
    left.chapterId === right.chapterId &&
    left.contentRevision === right.contentRevision &&
    left.targetLang === right.targetLang &&
    left.translationVersion === right.translationVersion
  );
}

export function missingSentenceIds(
  chapter: BilingualChapter,
  ids: string[],
): string[] {
  const sentences = new Set(
    chapter.units
      .filter((unit) => unit.kind === "sentence")
      .map((unit) => unit.id),
  );
  return [...new Set(ids)].filter(
    (id) => sentences.has(id) && !chapter.translations[id],
  );
}

export function nextSentenceBatch(
  chapter: BilingualChapter,
  ids: string[],
): string[] {
  const wanted = new Set(ids);
  const batch: string[] = [];
  let characters = 0;
  for (const unit of chapter.units) {
    if (!wanted.has(unit.id)) continue;
    if (batch.length >= 64 || characters + unit.text.length > 32768) break;
    batch.push(unit.id);
    characters += unit.text.length;
  }
  if (!batch.length && ids.length)
    throw new Error("This sentence is too long to translate.");
  return batch;
}
