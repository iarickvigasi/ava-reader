import { providerDownload, providerReference } from './provider-reference';
import { allowedProviderHost } from './allowed-host';
import { bootstrapSource } from '../bootstrap/bootstrap-source';
it('derives explicit canonical source and EPUB URLs without invented IA IDs', () => {
  const book = {
    provider: 'standard-ebooks' as const,
    providerId: 'jane-austen/emma',
  };
  expect(providerReference(book).sourceUrl).toBe(
    'https://standardebooks.org/ebooks/jane-austen/emma',
  );
  expect(providerDownload(book)).toBe(
    'https://standardebooks.org/ebooks/jane-austen/emma/downloads/jane-austen_emma.epub?source=download',
  );
  expect(
    providerDownload({ provider: 'wolne-lektury', providerId: 'pan-tadeusz' }),
  ).toBe('https://wolnelektury.pl/media/book/epub/pan-tadeusz.epub');
});
it.each([
  '../emma',
  'https://evil.test/emma',
  'jane-austen/emma?redirect=evil',
  'jane-austen/%2e%2e',
])('rejects unsafe provider IDs %s', (providerId) => {
  expect(() =>
    providerReference({ provider: 'standard-ebooks', providerId }),
  ).toThrow();
});
it('rejects cross-provider redirects and URLs with credentials', () => {
  expect(
    allowedProviderHost(
      new URL('https://wolnelektury.pl/book'),
      'standard-ebooks',
    ),
  ).toBe(false);
  expect(
    allowedProviderHost(
      new URL('https://standardebooks.org.evil.test/book'),
      'standard-ebooks',
    ),
  ).toBe(false);
  expect(
    allowedProviderHost(
      new URL('https://user:password@standardebooks.org/book'),
      'standard-ebooks',
    ),
  ).toBe(false);
  expect(
    allowedProviderHost(
      new URL('https://standardebooks.org/book'),
      'standard-ebooks',
    ),
  ).toBe(true);
});
it('keeps the same work across providers but creates provider-specific edition identities', () => {
  const work = { title: 'Emma', author: 'Jane Austen', language: 'en' };
  const ia = bootstrapSource({ ...work, iaIdentifier: 'emma' });
  const se = bootstrapSource({
    ...work,
    provider: 'standard-ebooks',
    providerId: 'jane-austen/emma',
  });
  expect(ia.externalId).toBe('curated:emma:en');
  expect(se.externalId).toMatch(/^curated:standard-ebooks:[a-f\d]{64}:en$/);
  expect(se.payload).not.toHaveProperty('ocaid');
});
