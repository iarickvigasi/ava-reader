import type { CanonicalBookV2 } from '../../pdf-conversion/contracts/generated/ava-book-2';

// The validated generated OPF uses accepted language, or the English profile default.
// This is the package language; it does not create a source-edition metadata claim.
export function validatedEpubLanguage(
  book: Pick<CanonicalBookV2, 'metadata' | 'profile_id'>,
): string {
  const languages = book.metadata
    .filter(
      (claim) => claim.status === 'accepted' && claim.field === 'language',
    )
    .map((claim) => claim.value);
  if (
    book.profile_id !== 'ava-pdf-prose-en-v2' ||
    new Set(languages).size > 1 ||
    languages.some((language) => !language || language.split('-')[0] !== 'en')
  )
    throw new Error('EPUB_PACKAGE_LANGUAGE_INVALID');
  return languages[0] ?? 'en';
}
