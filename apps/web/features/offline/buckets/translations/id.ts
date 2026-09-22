import type { TranslationScope } from "./types";

export function translationKey(
  scope: TranslationScope,
): [string, string, string] {
  return [scope.libraryItemId, scope.chapterId, scope.targetLang.trim()];
}
