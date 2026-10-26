import type { CatalogDatabase } from '../database/catalog-database';
import { applyPending } from './apply-pending';

jest.mock('node:timers/promises', () => ({ setTimeout: jest.fn() }));
afterEach(() => jest.restoreAllMocks());

it('keeps failed read phases in retry diagnostics without advancing or writing records', async () => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  const timeout = new Error('cancelled', { cause: { originalCode: '57014' } });
  const findMany = jest.fn().mockRejectedValue(timeout);
  const transaction = jest.fn();
  const db = {
    source: { findUnique: jest.fn().mockResolvedValue({ id: 'source' }) },
    importRun: { findMany: jest.fn().mockResolvedValue([{ id: 'run' }]) },
    importRecord: { findMany },
    $transaction: transaction,
  } as unknown as CatalogDatabase;
  await expect(applyPending(db)).rejects.toBe(timeout);
  const diagnostics = jest
    .mocked(console.error)
    .mock.calls.map(
      ([line]) => JSON.parse(line as string) as Record<string, unknown>,
    );
  const retries = diagnostics.filter(
    (row) => row.operation === 'readApplyBatch' && row.event === undefined,
  );
  expect(retries.map((row) => [row.attempt, row.retry])).toEqual([
    [1, true],
    [2, true],
    [3, false],
  ]);
  expect(
    retries.every(
      (row) => row.phase === 'pendingIds' && row.databaseCode === '57014',
    ),
  ).toBe(true);
  expect(new Set(retries.map((row) => row.readId)).size).toBe(3);
  expect(findMany).toHaveBeenCalledTimes(3);
  expect(transaction).not.toHaveBeenCalled();
});
