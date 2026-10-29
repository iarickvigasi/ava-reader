import { iaIdentifiers } from './ia-identifiers';

it('retains only explicit safe IA identities and deduplicates them', () => {
  expect(
    iaIdentifiers({
      ocaid: 'classic_01',
      identifiers: {
        ia: ['classic_01', 'other', '../bad', 'https://example.org'],
      },
    }),
  ).toEqual(['classic_01', 'other']);
  expect(
    iaIdentifiers({ links: [{ url: 'https://archive.org/details/guessed' }] }),
  ).toEqual([]);
});
