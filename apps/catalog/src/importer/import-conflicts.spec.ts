import { importConflicts } from './import-conflicts';
import { loadEditorial } from '../editorial/load-editorial';
import type { CatalogDatabase } from '../database/catalog-database';
jest.mock('../editorial/load-editorial');
it('reports retained incoming claims with their confirmed current identity and a bounded cursor', async () => {
  const findMany = jest.fn().mockResolvedValue([
    {
      id: 'record',
      externalId: '/works/OL1W',
      kind: 'WORK',
      run: { sourceId: 'source' },
      diagnostic: 'preserved originalTitle',
      payload: { title: 'Incoming' },
    },
  ]);
  const findUnique = jest.fn().mockResolvedValue({ workId: 'confirmed-work' });
  jest.mocked(loadEditorial).mockResolvedValue({
    id: 'confirmed-work',
    originalTitle: 'Admin title',
  } as never);
  const db = {
    importRecord: { findMany },
    sourceMapping: { findUnique },
  } as unknown as CatalogDatabase;
  const report = await importConflicts(db, 'cursor');
  const [query] = findMany.mock.calls[0] as [
    { take: number; where: { id: unknown } },
  ];
  expect(query.take).toBe(21);
  expect(query.where.id).toEqual({ gt: 'cursor' });
  expect(report.items[0]).toMatchObject({
    incoming: { title: 'Incoming' },
    current: { originalTitle: 'Admin title' },
  });
  expect(loadEditorial).toHaveBeenCalledWith(db, 'works', 'confirmed-work');
  expect(report.nextCursor).toBeNull();
});
