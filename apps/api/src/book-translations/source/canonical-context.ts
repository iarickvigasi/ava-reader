import { canonicalContentAuthority } from '../../reader/canonical/content-authority';
import type { OwnedLibraryItem } from '../../reader/library-item-access';
import type { AcceptedReader } from '../../reader/canonical/load';
import type { ReaderCapability } from '../../reader/canonical/semantic';
import { TRANSLATION_VERSION, type TranslationContext } from '../types';
import { canonicalSentenceCatalog } from './canonical-catalog';
export function canonicalTranslationContext(
  owned: OwnedLibraryItem,
  accepted: AcceptedReader,
  request: {
    chapterId: string;
    targetLang: string;
    capability: ReaderCapability;
  },
): TranslationContext {
  const book = accepted.readerPackage.book;
  const languages = [
    ...new Set(
      book.metadata
        .filter(
          (c) =>
            c.field === 'language' &&
            c.status === 'accepted' &&
            c.origin === 'source' &&
            c.value,
        )
        .map((c) => c.value!),
    ),
  ];
  const language = languages.length === 1 ? languages[0] : null;
  const contentRevision = accepted.readerPackage.final_content_id;
  return {
    libraryItemId: owned.id,
    userId: owned.userId,
    chapterId: request.chapterId,
    targetLang: request.targetLang.trim(),
    contentRevision,
    translationVersion: TRANSLATION_VERSION,
    title: owned.book.title,
    authors: owned.book.authors,
    sourceLanguage: language,
    units: canonicalSentenceCatalog(
      book,
      request.chapterId,
      contentRevision,
      language,
    ),
    canonicalAuthority: {
      ...canonicalContentAuthority(accepted),
      ...request.capability,
    },
  };
}
