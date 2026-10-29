import type { CatalogDatabase } from '../database/catalog-database';
import { saveEdition } from './save-edition';

it('does not relabel the language of an existing reading file', async () => {
  const findEdition = jest.fn();
  findEdition.mockResolvedValue({
    language: 'en',
    readingAssets: [{ id: 'asset' }],
  });
  const tx = {
    edition: { findUniqueOrThrow: findEdition, updateMany: jest.fn() },
  };
  const db = {
    $transaction: (operation: (tx: unknown) => unknown) => operation(tx),
  } as unknown as CatalogDatabase;
  await expect(
    saveEdition(db, 'edition', 1, {
      language: 'uk',
      format: 'EBOOK',
      publishedYear: 1850,
    }),
  ).rejects.toThrow('new copy');
  expect(tx.edition.updateMany).not.toHaveBeenCalled();
});
