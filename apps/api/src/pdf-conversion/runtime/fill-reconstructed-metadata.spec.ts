import { sourceDisplayMetadata } from './fill-reconstructed-metadata';
import type { MetadataClaim } from '../contracts/generated/ava-book-2';
function claim(
  field: MetadataClaim['field'],
  value: string,
  extra: Partial<MetadataClaim> = {},
): MetadataClaim {
  return {
    id: 'claim',
    field,
    value,
    status: 'accepted',
    origin: 'source',
    scope: 'work',
    ...extra,
  };
}
it('fills only unambiguous accepted source details and actual authors', () => {
  expect(
    sourceDisplayMetadata([
      claim('title', 'The Book'),
      claim('title', 'The Book'),
      claim('contributor', 'The Author', { contributor_role: 'author' }),
      claim('contributor', 'The Editor', { contributor_role: 'editor' }),
      claim('language', 'en'),
      claim('title', 'Generated', { origin: 'generated' }),
    ]),
  ).toEqual({ title: 'The Book', authors: ['The Author'], language: 'en' });
});
it('never guesses between conflicting, candidate, unknown or oversized fields', () => {
  expect(
    sourceDisplayMetadata([
      claim('title', 'A'),
      claim('title', 'B'),
      claim('language', 'en', { status: 'candidate' }),
      claim('contributor', 'C', {
        status: 'conflict',
        contributor_role: 'author',
      }),
      claim('language', 'fr', { status: 'unknown' }),
    ]),
  ).toEqual({});
  expect(sourceDisplayMetadata([claim('title', 'x'.repeat(1001))])).toEqual({});
});
