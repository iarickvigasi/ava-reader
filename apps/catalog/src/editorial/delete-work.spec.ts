import type { CatalogDatabase } from '../database/catalog-database';
import { deleteWork } from './delete-work';

it('hides the work and withdraws assets without erasing editions, files, or user copies', async () => {
  const tx = {
    work: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    readingAsset: { updateMany: jest.fn() },
  };
  const db = {
    $transaction: (operation: (tx: unknown) => unknown) => operation(tx),
  } as unknown as CatalogDatabase;
  await expect(deleteWork(db, 'work', 2)).resolves.toEqual({ deleted: true });
  const call = tx.work.updateMany.mock.calls[0] as [
    { where: unknown; data: { deletedAt: unknown; revision: unknown } },
  ];
  expect(call[0].where).toEqual({ id: 'work', revision: 2, deletedAt: null });
  expect(call[0].data.deletedAt).toBeInstanceOf(Date);
  expect(call[0].data.revision).toEqual({ increment: 1 });
  expect(tx.readingAsset.updateMany).toHaveBeenCalledWith({
    where: { edition: { workId: 'work' } },
    data: { status: 'WITHDRAWN' },
  });
});
