export const BILINGUAL_TRANSLATION_VERSION = 1;

export type BilingualUnit = {
  id: string;
  blockId: string;
  itemId?: string;
  startOffset: number;
  endOffset: number;
  text: string;
  kind: "sentence" | "image";
};

export type BilingualIdentity = {
  libraryItemId: string;
  chapterId: string;
  contentRevision: string;
  translationVersion: typeof BILINGUAL_TRANSLATION_VERSION;
  targetLang: string;
};

export type BilingualTranslations = BilingualIdentity & {
  translations: Record<string, string>;
};

export type BilingualChapter = BilingualTranslations & {
  units: BilingualUnit[];
};

export type BilingualGenerationRequest = Omit<
  BilingualIdentity,
  "libraryItemId"
> & {
  sentenceIds: string[];
};
