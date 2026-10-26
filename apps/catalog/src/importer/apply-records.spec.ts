import type { ImportRecord } from '#catalog-client';
import type { CatalogDatabase } from '../database/catalog-database';
import { applyRecords } from './apply-records';
import { applyRecord } from './apply-record';
import { InvalidRecord } from './types';

jest.mock('./apply-new-batch', () => ({
  applyNewBatch: jest.fn((_, records: unknown[]) =>
    Promise.resolve({ remaining: records, count: 0 }),
  ),
}));
jest.mock('./apply-record', () => ({ applyRecord: jest.fn() }));
jest.mock('node:timers/promises', () => ({ setTimeout: jest.fn() }));
const records = Array.from({ length: 50 }, (_, n) => ({
  id: String(n),
  runId: 'run',
  kind: 'AUTHOR',
  externalId: `/authors/${n}`,
})) as ImportRecord[];
const tx = { $executeRaw: jest.fn() };
const transaction = jest.fn(
  async (action: (client: typeof tx) => Promise<void>) => action(tx),
);
const update = jest.fn();
const db = {
  $transaction: transaction,
  importRecord: { update },
} as unknown as CatalogDatabase;

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(applyRecord).mockReset().mockResolvedValue(undefined);
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

it('commits a 50-record page in two bounded transactions', async () => {
  const result = await applyRecords(db, records, 'source');
  expect(result.transactions).toBe(2);
  expect(result.fallbackRecords).toBe(0);
  expect(tx.$executeRaw).toHaveBeenCalledTimes(2);
  expect(jest.mocked(applyRecord).mock.calls.map(([, row]) => row.id)).toEqual(
    records.map((r) => r.id),
  );
});

it('replays failed groups individually and quarantines only invalid records', async () => {
  jest.mocked(applyRecord).mockImplementation((_, row) => {
    if (row.id === '1') return Promise.reject(new InvalidRecord('bad aliases'));
    return Promise.resolve();
  });
  const result = await applyRecords(db, records.slice(0, 3), 'source');
  expect(result.transactions).toBe(4);
  expect(result.fallbackRecords).toBe(3);
  expect(update).toHaveBeenCalledWith({
    where: { id: '1' },
    data: { status: 'INVALID', diagnostic: 'bad aliases' },
  });
  expect(jest.mocked(applyRecord).mock.calls.map(([, row]) => row.id)).toEqual([
    '0',
    '1',
    '0',
    '1',
    '2',
  ]);
});

it('stops on operational failure without quarantining or advancing remaining records', async () => {
  const failure = new Error('database disconnected');
  jest.mocked(applyRecord).mockRejectedValue(failure);
  await expect(applyRecords(db, records.slice(0, 3), 'source')).rejects.toBe(
    failure,
  );
  expect(update).not.toHaveBeenCalled();
  expect(jest.mocked(applyRecord).mock.calls.map(([, row]) => row.id)).toEqual([
    '0',
    '0',
  ]);
});
