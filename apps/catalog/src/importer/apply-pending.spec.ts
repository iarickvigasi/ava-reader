import type { ImportRecord } from '#catalog-client';
import { applyPending } from './apply-pending';
import { readApplyBatch } from './read-apply-batch';
import { applyRecord } from './apply-record';
import type { CatalogDatabase } from '../database/catalog-database';

jest.mock('./read-apply-batch', () => ({ readApplyBatch: jest.fn() }));
jest.mock('./apply-record', () => ({ applyRecord: jest.fn() }));
jest.mock('node:timers/promises', () => ({
  setTimeout: jest.fn().mockResolvedValue(undefined),
}));

describe('applyPending recovery', () => {
  afterEach(() => jest.restoreAllMocks());

  it('retries the same page and replays a whole record transaction before advancing', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const timeout = { cause: { originalCode: '57014' } };
    const record = {
      id: 'record',
      runId: 'run',
      externalId: '/authors/1',
    } as ImportRecord;
    const findMany = jest
      .mocked(readApplyBatch)
      .mockRejectedValueOnce(timeout)
      .mockResolvedValueOnce([record])
      .mockResolvedValue([]);
    const tx = { $executeRaw: jest.fn() };
    const transaction = jest.fn(
      async (
        action: (value: typeof tx) => Promise<void>,
        options: { maxWait: number; timeout: number },
      ) => {
        expect(options.timeout).toBe(120000);
        return action(tx);
      },
    );
    jest
      .mocked(applyRecord)
      .mockRejectedValueOnce(timeout)
      .mockResolvedValue(undefined);
    const update = jest.fn();
    const db = {
      source: { findUnique: jest.fn().mockResolvedValue({ id: 'source' }) },
      importRun: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'run' }, { id: 'other-run' }]),
      },
      importRecord: { update },
      $transaction: transaction,
    };

    await applyPending(db as unknown as CatalogDatabase);

    expect(findMany.mock.calls[0]).toEqual(findMany.mock.calls[1]);
    const nextQuery: unknown = findMany.mock.calls[2][1];
    expect(nextQuery).toMatchObject({ after: 'record' });
    expect(transaction).toHaveBeenCalledTimes(2);
    expect(transaction.mock.calls[0][1]).toEqual({
      maxWait: 10000,
      timeout: 120000,
    });
    expect(tx.$executeRaw).toHaveBeenCalledTimes(2);
    expect(applyRecord).toHaveBeenCalledTimes(2);
    expect(update).not.toHaveBeenCalled();
    expect(findMany.mock.calls.slice(3).map(([, page]) => page)).toEqual([
      { runId: 'other-run', kind: 'AUTHOR', after: undefined },
      { runId: 'run', kind: 'WORK', after: undefined },
      { runId: 'other-run', kind: 'WORK', after: undefined },
      { runId: 'run', kind: 'EDITION', after: undefined },
      { runId: 'other-run', kind: 'EDITION', after: undefined },
    ]);
  });
});
