import { createHash } from 'node:crypto';
import { parseImportManifest } from './manifest';
import { importFixture } from './import-fixture';
const providerId = 'jane-austen/emma';
const hash = createHash('sha256').update(providerId).digest('hex');
const digital = {
  ...importFixture,
  review: null,
  iaIdentifier: undefined,
  sourceKey: 'curated-classics',
  provider: 'standard-ebooks',
  providerId,
  externalId: `curated:standard-ebooks:${hash}:en`,
  sourceUrl: 'https://standardebooks.org/ebooks/jane-austen/emma',
  downloadUrl:
    'https://standardebooks.org/ebooks/jane-austen/emma/downloads/jane-austen_emma.epub?source=download',
};
it('accepts unapproved exact-source digital drafts and keeps legacy manifests valid', () => {
  expect(parseImportManifest(JSON.stringify(digital))).toMatchObject({
    provider: 'standard-ebooks',
    review: null,
  });
  expect(parseImportManifest(JSON.stringify(importFixture))).toEqual(
    importFixture,
  );
});
it.each([
  { ...digital, iaIdentifier: 'fabricated' },
  { ...digital, providerId: 'other/book' },
  { ...digital, sourceUrl: 'https://evil.test/edition' },
  { ...digital, downloadUrl: 'http://127.0.0.1/private' },
  { ...digital, sourceKey: 'open-library' },
])(
  'rejects mixed identity, mismatched edition IDs, and arbitrary URLs',
  (value) => {
    expect(() => parseImportManifest(JSON.stringify(value))).toThrow();
  },
);
