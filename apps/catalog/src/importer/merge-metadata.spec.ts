import { mergeMetadata } from './merge-metadata';
it('fills gaps, unions lists, preserves nonempty values, and reports differences', () => {
  const conflicts: string[] = [];
  const patch = mergeMetadata(
    { title: 'Admin title', language: null, subjects: ['Novel'], revision: 7 },
    {
      title: 'Provider title',
      language: 'uk',
      subjects: ['Novel', 'Drama'],
      revision: 8,
    },
    conflicts,
  );
  expect(patch).toEqual({
    language: 'uk',
    subjects: ['Novel', 'Drama'],
    revision: 8,
  });
  expect(conflicts).toEqual(['title']);
});
it('preserves explicitly cleared fields and removed list members', () => {
  const conflicts: string[] = [];
  expect(
    mergeMetadata(
      {
        publisher: null,
        subjects: [],
        metadataOverrides: ['publisher', 'subjects:Wrong'],
      },
      { publisher: 'Wrong', subjects: ['Wrong', 'Poetry'] },
      conflicts,
    ),
  ).toEqual({ subjects: ['Poetry'] });
  expect(conflicts).toEqual(['publisher', 'subjects']);
});
it('protects localized corrections while allowing unrelated locale enrichment', () => {
  const conflicts: string[] = [];
  expect(
    mergeMetadata(
      { description: null },
      { description: 'Provider' },
      conflicts,
      'texts:uk:',
      ['texts:uk:description'],
    ),
  ).toEqual({});
  expect(conflicts).toEqual(['texts:uk:description']);
});
