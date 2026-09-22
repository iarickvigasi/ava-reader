import type { ReaderChapter } from '../../reader/reader-types';
import type { TranslationContext } from '../types';
import { buildSentenceCatalog } from '../source/sentence-catalog';

export const chapterFixture: ReaderChapter = {
  chapterId: 'chapter-1',
  href: 'chapter.xhtml',
  label: 'Chapter one',
  title: 'One',
  previousChapterId: null,
  nextChapterId: null,
  spineIndex: 0,
  blocks: [
    {
      id: 'p-1',
      kind: 'paragraph',
      text: 'Hello reader. Another sentence.',
      inlines: [{ kind: 'text', text: 'Hello reader. Another sentence.' }],
    },
  ],
};

export function translationContext(): TranslationContext {
  return {
    libraryItemId: 'library-1',
    userId: 'user-1',
    chapterId: 'chapter-1',
    contentRevision: 'file-1',
    translationVersion: 1,
    targetLang: 'French',
    title: 'Book',
    authors: ['Writer'],
    sourceLanguage: 'en',
    units: buildSentenceCatalog(chapterFixture, 'file-1', 'en'),
  };
}
