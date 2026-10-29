import type { CatalogDatabase } from '../database/catalog-database';
import { inventory } from './inventory';
import { findClassicEditions } from './find-classic-editions';
import { editionCandidates } from './edition-candidates';

jest.mock('./find-classic-editions');
jest.mock('./edition-candidates');
const findEditions = jest.mocked(findClassicEditions);
const getCandidates = jest.mocked(editionCandidates);
let log: jest.SpyInstance;
beforeEach(() => {
  jest.resetAllMocks();
  log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  findEditions.mockResolvedValue([]);
});
afterEach(() => log.mockRestore());

it('limits a language-specific inventory to that language, including its log metadata', async () => {
  const result = await inventory({} as CatalogDatabase, 100, 'pl');
  expect(result.candidates).toEqual([]);
  expect(findEditions).toHaveBeenCalledTimes(50);
  expect(
    findEditions.mock.calls.every(([, seed]) => seed.language === 'pl'),
  ).toBe(true);
  expect(log).toHaveBeenCalledWith(expect.stringContaining('"language":"pl"'));
  expect(getCandidates).not.toHaveBeenCalled();
});

it('stops at the existing global candidate cap even with the expanded multilingual seeds', async () => {
  const edition = { id: 'edition' } as Awaited<
    ReturnType<typeof findClassicEditions>
  >[number];
  findEditions.mockResolvedValue([edition]);
  getCandidates.mockResolvedValue(
    Array.from({ length: 10 }, (_, index) => ({
      editionId: `edition-${index}`,
      workId: 'work',
      externalId: '/books/OL1M',
      sourceRevision: '1',
      sourcePayloadHash: 'hash',
      title: 'Енеїда',
      language: 'uk',
      iaIdentifier: `item-${index}`,
      authors: ['Іван Петрович Котляревський'],
      review: null,
    })),
  );
  const result = await inventory({} as CatalogDatabase, 3);
  expect(result.candidates).toHaveLength(3);
  expect(findEditions).toHaveBeenCalledTimes(1);
});
