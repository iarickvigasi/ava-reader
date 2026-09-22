import { normalizeBookLanguage } from '../../shared/book-utils';

export function createSentenceSegmenter(sourceLanguage: string | null) {
  const language = normalizeBookLanguage(sourceLanguage);
  // Keep missing or unusable metadata independent of the server's default locale.
  let locale = 'en';
  try {
    locale =
      Intl.Segmenter.supportedLocalesOf(language ? [language] : [])[0] ??
      locale;
  } catch {
    // Imported metadata may contain a language name or an invalid locale tag.
  }
  return new Intl.Segmenter(locale, { granularity: 'sentence' });
}
