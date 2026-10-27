import type { CatalogDatabase } from '../database/catalog-database';
import { readApplyBatch } from './read-apply-batch';
import { batchSettings } from './batch-settings';

it('advances only through returned payloads when the byte budget truncates a page', async () => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  const rows = ['000', '001', '002'].map((id) => ({
    id,
    payload: id === '001' ? 'x'.repeat(100) : 'a',
  }));
  const findMany = jest.fn(
    (query: {
      select?: unknown;
      where: { status?: string; id?: { gt?: string; in?: string[] } };
    }) => {
      if (query.select)
        return Promise.resolve(
          query.where.status === 'PENDING'
            ? rows
                .filter((row) => row.id > (query.where.id?.gt ?? ''))
                .map(({ id }) => ({ id }))
            : [],
        );
      return Promise.resolve(
        rows.filter((row) => query.where.id?.in?.includes(row.id)),
      );
    },
  );
  const db = { importRecord: { findMany } } as unknown as CatalogDatabase;
  const settings = { ...batchSettings({}), readBytes: 5 };
  try {
    let after: string | undefined;
    const visited: string[] = [];
    for (let i = 0; i < 3; i++) {
      const page = await readApplyBatch(
        db,
        { runId: 'run', kind: 'AUTHOR', after },
        undefined,
        settings,
      );
      expect(page).toHaveLength(1);
      visited.push(page[0].id);
      after = page[0].id;
    }
    expect(visited).toEqual(rows.map((row) => row.id));
  } finally {
    jest.restoreAllMocks();
  }
});
