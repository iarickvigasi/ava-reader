import type { NarrationInput } from "./selection-narration-input";
import { bilingualLanguageTag } from "@/features/reader/bilingual/content/language-tag";

export type TranslationNarrationSource = {
  text: string;
  context?: string;
  bookTitle?: string;
  author?: string;
};

export function translationNarrationInput(input: {
  text: string;
  language: string;
  source?: TranslationNarrationSource;
}): NarrationInput {
  const context = [
    `Displayed translation: ${input.text}`,
    input.source?.text && `Original selection: ${input.source?.text}`,
    input.source?.bookTitle && `Book: ${input.source?.bookTitle}`,
    input.source?.author && `Author: ${input.source?.author}`,
    input.source?.context &&
      `Original sentence context: ${input.source?.context}`,
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 8192);
  const tag = bilingualLanguageTag(input.language);
  return {
    text: input.text,
    context,
    languageHint: input.language,
    translationLanguage: tag ? new Intl.Locale(tag).language : undefined,
  };
}
