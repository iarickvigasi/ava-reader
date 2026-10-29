import type { Prisma } from '#catalog-client';
import { attachImportedCover } from './attach-imported-cover';
const findFirst = jest.fn();
const updateMany = jest.fn();
const db = {
  publicBlob: { findFirst },
  edition: { updateMany },
} as unknown as Prisma.TransactionClient;
beforeEach(() => jest.resetAllMocks());
it('preserves manually assigned covers and attaches only a validated Catalog cover', async () => {
  findFirst.mockResolvedValue({ id: 'cover' });
  await attachImportedCover(db, 'edition', 'cover');
  expect(updateMany).toHaveBeenCalledWith({
    where: { id: 'edition', coverImageUrl: null },
    data: { coverImageUrl: '/catalog/api/edition-covers/cover' },
  });
});
it('rejects missing or non-image blobs and leaves metadata unchanged', async () => {
  findFirst.mockResolvedValue(null);
  await expect(attachImportedCover(db, 'edition', 'source')).rejects.toThrow(
    'Catalog image cover',
  );
  expect(updateMany).not.toHaveBeenCalled();
});
it('leaves editions without embedded covers untouched', async () => {
  await attachImportedCover(db, 'edition');
  expect(findFirst).not.toHaveBeenCalled();
  expect(updateMany).not.toHaveBeenCalled();
});
