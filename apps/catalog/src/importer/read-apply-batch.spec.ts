import { readApplyBatch } from './read-apply-batch';
import type { CatalogDatabase } from '../database/catalog-database';
import { APPLY_BATCH_SIZE, RecordStatus } from './types';

describe('readApplyBatch', () => {
  it('merges bounded status pages before loading payloads and advances both statuses', async () => {
    const pending = Array.from({ length: 50 }, (_, i) => ({
      id: String(i * 2).padStart(3, '0'),
    }));
    const unresolved = Array.from({ length: 50 }, (_, i) => ({
      id: String(i * 2 + 1).padStart(3, '0'),
    }));
    const findMany = jest
      .fn()
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce(unresolved)
      .mockImplementation((input: { where: { id: { in: string[] } } }) =>
        Promise.resolve(input.where.id.in.map((id) => ({ id, payload: null }))),
      );
    const db = { importRecord: { findMany } } as unknown as CatalogDatabase;
    const page = { runId: 'run', kind: 'AUTHOR' as const, after: 'previous' };
    await expect(readApplyBatch(db, page)).resolves.toHaveLength(50);
    for (const [index, status] of [
      RecordStatus.PENDING,
      RecordStatus.UNRESOLVED,
    ].entries()) {
      expect(findMany).toHaveBeenNthCalledWith(index + 1, {
        where: { runId: 'run', kind: 'AUTHOR', status, id: { gt: 'previous' } },
        select: { id: true },
        orderBy: { id: 'asc' },
        take: APPLY_BATCH_SIZE,
      });
    }
    const payloadQueries = findMany.mock.calls.slice(2) as unknown as [
      { where: { id: { in: string[] } } },
    ][];
    expect(payloadQueries.flatMap(([query]) => query.where.id.in)).toEqual(
      Array.from({ length: 50 }, (_, i) => String(i).padStart(3, '0')),
    );
    expect(
      payloadQueries.every(([query]) => query.where.id.in.length <= 8),
    ).toBe(true);
  });

  it('does not fetch payloads for an exhausted run/kind', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const db = { importRecord: { findMany } } as unknown as CatalogDatabase;
    await expect(
      readApplyBatch(db, { runId: 'run', kind: 'WORK' }),
    ).resolves.toEqual([]);
    expect(findMany).toHaveBeenCalledTimes(2);
  });
});
