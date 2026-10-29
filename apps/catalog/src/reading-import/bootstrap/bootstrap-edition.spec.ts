import { createHash } from 'node:crypto';
import { bootstrapEdition } from './bootstrap-edition';
import type { CatalogDatabase } from '../../database/catalog-database';
it('replays an existing curated edition without creating new work, edition, file, or source rows', async () => {
  const mapping = { editionId: 'edition', payloadHash: 'hash' };
  const tx = {
    source: { upsert: jest.fn().mockResolvedValue({ id: 'source' }) },
    sourceMapping: { findUnique: jest.fn().mockResolvedValue(mapping) },
    edition: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        id: 'edition',
        workId: 'work',
        title: 'Pride and Prejudice',
        language: 'en',
        work: { deletedAt: null },
      }),
    },
  };
  const db = {
    $transaction: (run: (value: typeof tx) => unknown) => run(tx),
  } as unknown as CatalogDatabase;
  const book = {
    title: 'Pride and Prejudice',
    author: 'Jane Austen',
    language: 'en',
    iaIdentifier: 'verified-item',
  };
  mapping.payloadHash = createHash('sha256')
    .update(
      JSON.stringify({
        title: book.title,
        author: book.author,
        language: book.language,
        ocaid: book.iaIdentifier,
      }),
    )
    .digest('hex');
  expect(await bootstrapEdition(db, book)).toMatchObject({
    editionId: 'edition',
    workId: 'work',
    sourceKey: 'curated-classics',
  });
  await expect(
    bootstrapEdition(db, { ...book, title: 'Different' }),
  ).rejects.toThrow('another work');
});
