import { openLibraryCover } from './open-library-cover';
import { readerCategories, CATEGORY_VERSION } from './reader-categories';
import { strings, text } from './raw-fields';
import { normalizeLanguage } from './normalize-language';
import type { Raw } from './types';

export function workData(raw: Raw, revision: number) {
  const subjects = strings(raw.subjects);
  return {
    originalTitle: text(raw.title)!,
    originalLanguage: normalizeLanguage(raw.original_language),
    revision,
    ...openLibraryCover(raw.covers),
    subjects,
    categories: subjects ? readerCategories(subjects) : undefined,
    categoryVersion: subjects ? CATEGORY_VERSION : undefined,
    metadataIncomplete: false,
  };
}
