import { rebuildCategories } from './rebuild-categories';
import type { CatalogDatabase } from '../database/catalog-database';

const work = {
  id: 'work',
  originalTitle: 'Criticism',
  revision: 3,
  categoryVersion: 1,
  categories: ['history'],
  subjects: ['Fantasy fiction, history and criticism'],
};
function database(count: number) {
  const tx = {
    work: { updateMany: jest.fn().mockResolvedValue({ count }) },
    sourceMapping: { updateMany: jest.fn() },
    catalogOutbox: { create: jest.fn() },
  };
  const db = {
    work: {
      findMany: jest.fn().mockResolvedValueOnce([work]).mockResolvedValue([]),
    },
    $transaction: jest.fn((run: (client: typeof tx) => unknown) => run(tx)),
  };
  return { db: db as unknown as CatalogDatabase, tx };
}
describe('category rebuild', () => {
  it('reports a dry-run without writing and shows actual category changes', async () => {
    const { db, tx } = database(1);
    const report = await rebuildCategories(db, false);
    expect(report).toMatchObject({
      scanned: 1,
      changed: 1,
      recategorized: 1,
      applied: 0,
    });
    expect(report.examples[0].after).toEqual([]);
    expect(tx.work.updateMany).not.toHaveBeenCalled();
  });
  it('preserves source-managed ownership and emits a revisioned event atomically', async () => {
    const { db, tx } = database(1);
    expect((await rebuildCategories(db, true)).applied).toBe(1);
    expect(tx.work.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'work', revision: 3 } }),
    );
    expect(tx.sourceMapping.updateMany).toHaveBeenCalledWith({
      where: { workId: 'work', managedRevision: 3 },
      data: { managedRevision: 4 },
    });
    expect(tx.catalogOutbox.create).toHaveBeenCalledWith({
      data: {
        kind: 'WORK',
        entityId: 'work',
        revision: 4,
        eventType: 'CATEGORIES_REBUILT',
      },
    });
  });
  it('leaves concurrent updates untouched', async () => {
    const { db, tx } = database(0);
    expect((await rebuildCategories(db, true)).conflicts).toBe(1);
    expect(tx.sourceMapping.updateMany).not.toHaveBeenCalled();
    expect(tx.catalogOutbox.create).not.toHaveBeenCalled();
  });
});
