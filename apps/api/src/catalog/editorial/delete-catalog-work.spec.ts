import type { PrismaService } from '../../prisma/prisma.service';
import { deleteCatalogWork } from './delete-catalog-work';
import { catalogEditorialRequest } from './catalog-editorial-request';
import { syncPublication } from '../publication/sync-publication';

jest.mock('./catalog-editorial-request');
jest.mock('../publication/sync-publication');
const request = jest.mocked(catalogEditorialRequest);
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(syncPublication).mockResolvedValue(undefined);
});
it('refuses a stale delete before archiving reading copies', async () => {
  request.mockResolvedValueOnce({ revision: 3 });
  const transaction = jest.fn();
  await expect(
    deleteCatalogWork(
      { $transaction: transaction } as unknown as PrismaService,
      'work',
      2,
    ),
  ).rejects.toThrow('reload');
  expect(transaction).not.toHaveBeenCalled();
});
it('archives only public entries and schedules withdrawal without deleting personal membership', async () => {
  request
    .mockResolvedValueOnce({
      revision: 2,
      editions: [{ readingAssets: [{ mainCatalogEntryId: 'manual-entry' }] }],
    })
    .mockResolvedValueOnce({ deleted: true });
  const tx = {
    catalogEntry: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'imported', importKey: 'key' },
        { id: 'manual-entry', importKey: null },
      ]),
      updateMany: jest.fn(),
    },
  };
  const db = {
    $transaction: (operation: (tx: unknown) => unknown) => operation(tx),
  } as unknown as PrismaService;
  await deleteCatalogWork(db, 'work', 2);
  const query = tx.catalogEntry.findMany.mock.calls[0] as [
    { where: { book: unknown } },
  ];
  expect(query[0].where.book).toMatchObject({
    visibility: 'PUBLIC',
    privateOwnerId: null,
  });
  expect(tx.catalogEntry.updateMany).toHaveBeenCalledTimes(2);
  expect(syncPublication).toHaveBeenCalledWith(db, 'imported');
  expect(request).toHaveBeenLastCalledWith({
    operation: 'delete',
    kind: 'works',
    id: 'work',
    revision: 2,
  });
});
