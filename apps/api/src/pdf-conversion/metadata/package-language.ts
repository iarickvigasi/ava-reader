import type { CanonicalBookV2 } from '../contracts/generated/ava-book-2';

// The extended profile requires accepted language; only the legacy English profile defaults.
// This is the package language; it does not create a source-edition metadata claim.
export function validatedPackageLanguage(
  book: Pick<CanonicalBookV2, 'metadata' | 'profile_id'>,
): string {
  const languages = book.metadata
    .filter(
      (claim) => claim.status === 'accepted' && claim.field === 'language',
    )
    .map((claim) => claim.value);
  const extended = book.profile_id === 'ava-pdf-prose-en-uk-v3';
  if (
    (!extended && book.profile_id !== 'ava-pdf-prose-en-v2') ||
    (extended && languages.length === 0) ||
    new Set(languages).size > 1 ||
    languages.some(
      (language) =>
        !language ||
        !(extended ? ['en', 'uk'] : ['en']).includes(language.split('-')[0]),
    )
  )
    throw new Error('EPUB_PACKAGE_LANGUAGE_INVALID');
  return languages[0] ?? 'en';
}
