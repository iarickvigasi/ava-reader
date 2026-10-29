import { metadataOverrides } from './metadata-overrides';
it('records only changed scalars, explicit clears, removals, and localized corrections', () => {
  expect(
    metadataOverrides(
      {
        title: 'Same',
        publisher: 'Old',
        subjects: ['Kept', 'Removed'],
        credits: [{ authorId: 'a', role: 'AUTHOR' }],
        texts: [{ locale: 'uk', title: 'Назва', description: 'Old' }],
        metadataOverrides: ['coverImageUrl'],
      },
      {
        title: 'Same',
        publisher: null,
        subjects: ['Kept'],
        credits: [],
        texts: [{ locale: 'uk', title: 'Назва', description: null }],
      },
    ),
  ).toEqual([
    'coverImageUrl',
    'publisher',
    'subjects:Removed',
    'credits:a:AUTHOR',
    'texts:uk:description',
  ]);
});
it('protects removed translations without blocking new locales', () => {
  expect(
    metadataOverrides(
      { texts: [{ locale: 'de', title: 'Old' }] },
      { texts: [] },
    ),
  ).toEqual(['texts:de']);
});
