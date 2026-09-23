export const TRANSLATION_VERSION = 1 as const;
export const MAX_TRANSLATION_SENTENCES = 64;
export const MAX_TRANSLATION_CHARACTERS = 32_768;

export type BilingualUnit = {
  id: string;
  blockId: string;
  itemId?: string;
  startOffset: number;
  endOffset: number;
  text: string;
  kind: 'sentence' | 'image';
};

export type TranslationIdentity = {
  libraryItemId: string;
  chapterId: string;
  contentRevision: string;
  translationVersion: typeof TRANSLATION_VERSION;
  targetLang: string;
};

export type TranslationResult = TranslationIdentity & {
  translations: Record<string, string>;
  alignments?: Record<string, SentenceAlignment>;
};

export type AlignmentSpan = { start: number; end: number };
export type SentenceAlignment = {
  version: 2;
  sourceText: string;
  translatedText: string;
  groups: {
    id: string;
    source: AlignmentSpan[];
    translation: AlignmentSpan[];
  }[];
};

export type ChapterTranslation = TranslationResult & { units: BilingualUnit[] };

export type TranslationContext = TranslationIdentity & {
  userId: string;
  title: string;
  authors: string[];
  sourceLanguage: string | null;
  units: BilingualUnit[];
};
