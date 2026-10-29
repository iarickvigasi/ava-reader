import type { CatalogDatabase } from '../database/catalog-database';
import { reassignEdition } from './reassign-edition';
function fixture(work: object | null = { revision: 3 }, currentWork = 'old') {
  const updateMany = jest.fn().mockResolvedValue({ count: 1 });
  const tx = {
    $queryRaw: jest.fn(),
    catalogOutbox: { create: jest.fn() },
    work: { findUnique: jest.fn().mockResolvedValue(work) },
    edition: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({ workId: currentWork }),
      updateMany,
    },
  };
  const db = {
    $transaction: (run: (value: typeof tx) => unknown) => run(tx),
  } as unknown as CatalogDatabase;
  return { db, updateMany };
}
it('moves only the work relationship and version, keeping edition/file identity', async () => {
  const f = fixture();
  await reassignEdition(f.db, 'edition', 'work', 2, 3);
  expect(f.updateMany).toHaveBeenCalledWith({
    where: { id: 'edition', revision: 2 },
    data: { workId: 'work', revision: { increment: 1 } },
  });
});
it('allows replay after Catalog succeeded but Main delivery failed', async () => {
  const f = fixture({ revision: 3 }, 'work');
  await expect(reassignEdition(f.db, 'edition', 'work', 2, 3)).resolves.toEqual(
    { editionId: 'edition', workId: 'work' },
  );
  expect(f.updateMany).not.toHaveBeenCalled();
});
it('rejects deleted targets and stale work or edition revisions', async () => {
  await expect(
    reassignEdition(fixture(null).db, 'edition', 'work', 2, 3),
  ).rejects.toThrow('not found');
  await expect(
    reassignEdition(fixture({ revision: 4 }).db, 'edition', 'work', 2, 3),
  ).rejects.toThrow('changed');
  const f = fixture();
  f.updateMany.mockResolvedValue({ count: 0 });
  await expect(reassignEdition(f.db, 'edition', 'work', 2, 3)).rejects.toThrow(
    'changed',
  );
});
