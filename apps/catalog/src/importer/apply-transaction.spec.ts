import { records, db, metrics } from '../../test/transaction-unit-fixture';
import { applyTransaction } from './apply-transaction';
import { applyRecord } from './apply-record';
import { applyNewBatch } from './apply-new-batch';
import type { ImportStep } from './import-operation';

jest.mock('./apply-record', () => ({ applyRecord: jest.fn() }));
jest.mock('./apply-new-batch', () => ({ applyNewBatch: jest.fn() }));
jest.mock('node:timers/promises', () => ({ setTimeout: jest.fn() }));
beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(applyNewBatch)
    .mockReset()
    .mockImplementation((_, rows) =>
      Promise.resolve({ remaining: rows, count: 0 }),
    );
  jest.mocked(applyRecord).mockReset().mockResolvedValue(undefined);
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

it('names the actual sequential record instead of the first record', async () => {
  jest
    .mocked(applyRecord)
    .mockImplementation((_, row) =>
      row.id === '2' ? Promise.reject(new Error('bad')) : Promise.resolve(),
    );
  await expect(
    applyTransaction(db, records, 'source', metrics()),
  ).rejects.toThrow('bad');
  const diagnostic = JSON.parse(
    jest.mocked(console.error).mock.calls[0][0] as string,
  ) as Record<string, unknown>;
  expect(diagnostic).toMatchObject({
    recordId: '2',
    externalId: '/authors/2',
    phase: 'record',
    batchSize: 2,
  });
});

it('names the bulk operation and group without blaming a particular record', async () => {
  jest
    .mocked(applyNewBatch)
    .mockImplementation((_, __, ___, step) =>
      (step as ImportStep)('editionIdentifier.createMany', () =>
        Promise.reject(new Error('bulk failed')),
      ),
    );
  await expect(
    applyTransaction(db, records, 'source', metrics()),
  ).rejects.toThrow('bulk failed');
  const diagnostic = JSON.parse(
    jest.mocked(console.error).mock.calls[0][0] as string,
  ) as Record<string, unknown>;
  expect(diagnostic).toMatchObject({
    databaseOperation: 'editionIdentifier.createMany',
    phase: 'bulk',
    batchFirstRecordId: '1',
    batchLastRecordId: '2',
  });
  expect(diagnostic).not.toHaveProperty('recordId');
});

it('retries an entire group after transient failure and resets its context', async () => {
  jest
    .mocked(applyRecord)
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(
      new Error('cancelled', { cause: { originalCode: '57014' } }),
    )
    .mockResolvedValue(undefined);
  const result = metrics();
  await applyTransaction(db, records, 'source', result);
  expect(result.transactions).toBe(2);
  expect(jest.mocked(applyRecord).mock.calls.map(([, row]) => row.id)).toEqual([
    '1',
    '2',
    '1',
    '2',
  ]);
});
