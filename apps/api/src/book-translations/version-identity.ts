import type { TranslationContext, TranslationIdentity } from './types';

export function translationVersionIdentity(context: TranslationContext) {
  return {
    userId: context.userId,
    libraryItemId: context.libraryItemId,
    contentRevision: context.contentRevision,
    targetLang: context.targetLang,
    translationVersion: context.translationVersion,
  };
}

export function translationResponseIdentity(
  context: TranslationContext,
): TranslationIdentity {
  const {
    libraryItemId,
    chapterId,
    contentRevision,
    targetLang,
    translationVersion,
  } = context;
  return {
    libraryItemId,
    chapterId,
    contentRevision,
    targetLang,
    translationVersion,
  };
}
