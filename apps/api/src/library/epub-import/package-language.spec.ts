import type { MetadataClaim } from '../../pdf-conversion/contracts/generated/ava-book-2';
import { validatedEpubLanguage } from './package-language';
const claim = (
  value: string | null,
  status: MetadataClaim['status'] = 'accepted',
): MetadataClaim => ({
  id: 'language',
  field: 'language',
  value,
  status,
  origin: 'generated',
  scope: 'conversion',
  contributor_role: null,
  identifier_scheme: null,
  evidence: [],
});
const book = (metadata: MetadataClaim[]) => ({
  profile_id: 'ava-pdf-prose-en-v2' as const,
  metadata,
});
it('uses exactly the accepted package locale, including generated provenance', () => {
  expect(validatedEpubLanguage(book([claim('en-GB')]))).toBe('en-GB');
  expect(validatedEpubLanguage(book([claim('en-US'), claim('en-US')]))).toBe(
    'en-US',
  );
});
it('ignores unaccepted candidate language and uses the validated English profile', () => {
  expect(validatedEpubLanguage(book([claim('fr', 'candidate')]))).toBe('en');
});
it.each([[claim('en'), claim('en-GB')], [claim('fr')], [claim(null)]])(
  'refuses an invalid or ambiguous accepted package language',
  (...metadata) => {
    expect(() => validatedEpubLanguage(book(metadata))).toThrow(
      'EPUB_PACKAGE_LANGUAGE_INVALID',
    );
  },
);
