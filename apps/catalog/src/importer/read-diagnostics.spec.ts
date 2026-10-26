import type { CatalogDatabase } from '../database/catalog-database';
import { readApplyBatch } from './read-apply-batch';
import type { ImportContext } from './import-operation';

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());
const page = { kind: 'AUTHOR' as const, runId: 'run', after: 'cursor' };
const logs = () =>
  jest
    .mocked(console.log)
    .mock.calls.map(
      ([line]) => JSON.parse(line as string) as Record<string, unknown>,
    );

it('correlates all read phases and reports counts without payloads', async () => {
  const findMany = jest
    .fn()
    .mockResolvedValueOnce([{ id: 'id' }])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ id: 'id', payload: 'private-data' }]);
  await readApplyBatch(
    { importRecord: { findMany } } as unknown as CatalogDatabase,
    page,
  );
  expect(logs().map((row) => [row.phase, row.state])).toEqual([
    ['pendingIds', 'started'],
    ['pendingIds', 'completed'],
    ['unresolvedIds', 'started'],
    ['unresolvedIds', 'completed'],
    ['payloads', 'started'],
    ['payloads', 'completed'],
  ]);
  expect(new Set(logs().map((row) => row.readId)).size).toBe(1);
  expect(
    logs()
      .filter((row) => row.state === 'completed')
      .map((row) => row.records),
  ).toEqual([1, 0, 1]);
  expect(JSON.stringify(logs())).not.toContain('private-data');
});

it.each(['pendingIds', 'unresolvedIds', 'payloads'])(
  'identifies a %s failure and preserves the original error/context',
  async (phase) => {
    const stages = ['pendingIds', 'unresolvedIds', 'payloads'];
    const findMany = jest.fn();
    for (let index = 0; index < stages.indexOf(phase); index++) {
      findMany.mockResolvedValueOnce(index === 0 ? [{ id: 'id' }] : []);
    }
    const error = new Error('cancelled', { cause: { originalCode: '57014' } });
    findMany.mockRejectedValueOnce(error);
    const context: ImportContext = { operation: 'readApplyBatch', ...page };
    await expect(
      readApplyBatch(
        { importRecord: { findMany } } as unknown as CatalogDatabase,
        page,
        context,
      ),
    ).rejects.toBe(error);
    expect(context).toMatchObject({
      phase,
      databaseOperation: 'importRecord.findMany',
    });
    const diagnostic = JSON.parse(
      jest.mocked(console.error).mock.calls[0][0] as string,
    ) as Record<string, unknown>;
    expect(diagnostic).toMatchObject({
      event: 'importRead',
      state: 'failed',
      phase,
      runId: 'run',
      after: 'cursor',
      databaseCode: '57014',
      readId: context.readId,
    });
  },
);

it('emits started while the database query is still pending', async () => {
  let rejectRead!: (error: Error) => void;
  const waiting = new Promise<never>((_, reject) => {
    rejectRead = reject;
  });
  const findMany = jest.fn().mockReturnValue(waiting);
  const error = new Error('stopped');
  const result = readApplyBatch(
    { importRecord: { findMany } } as unknown as CatalogDatabase,
    page,
  );
  const rejected = expect(result).rejects.toBe(error);
  expect(logs()).toEqual([
    expect.objectContaining({ phase: 'pendingIds', state: 'started' }),
  ]);
  rejectRead(error);
  await rejected;
});
