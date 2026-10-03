import type { ReaderCapability } from '../reader/canonical/semantic';
import type { GenerateTranslationRequest } from './dto';
export type ChapterTranslationRequest = {
  capability?: ReaderCapability;
  clerkUserId: string;
  libraryItemId: string;
  chapterId: string;
  targetLang: string;
};
export type GenerateChapterTranslationRequest = GenerateTranslationRequest & {
  clerkUserId: string;
  libraryItemId: string;
  signal: AbortSignal;
  capability?: ReaderCapability;
};
