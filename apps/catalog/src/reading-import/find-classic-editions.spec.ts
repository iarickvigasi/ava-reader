import type { CatalogDatabase } from '../database/catalog-database';
import { CLASSICS } from './classics';
import { findClassicEditions } from './find-classic-editions';

it('requires the selected edition language and a credited author even for localized titles', async () => {
  const findMany = jest
    .fn<Promise<unknown[]>, [unknown]>()
    .mockResolvedValue([]);
  const db = { edition: { findMany } } as unknown as CatalogDatabase;
  const seed = CLASSICS.find((classic) => classic.title === 'Енеїда')!;
  await findClassicEditions(db, seed);
  const query = findMany.mock.calls[0][0] as { where: unknown };
  expect(query.where).toMatchObject({
    language: 'uk',
    work: { metadataIncomplete: false, credits: { some: { role: 'AUTHOR' } } },
    OR: [
      { title: { in: ['Енеїда', 'Eneida'] } },
      { work: { originalTitle: { in: ['Енеїда', 'Eneida'] } } },
      {
        work: {
          texts: {
            some: { locale: 'uk', title: { in: ['Енеїда', 'Eneida'] } },
          },
        },
      },
    ],
  });
});
