import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ImportRun } from '#catalog-client';
import type { CatalogDatabase } from '../database/catalog-database';
import { stageLines } from './stage-lines';

it('flushes by bytes without checkpointing the next uncommitted line', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ava-batch-'));
  try {
    const path = join(directory, 'dump.txt');
    await writeFile(path, ('x'.repeat(3 * 1024 * 1024) + '\n').repeat(2));
    const update = jest.fn().mockResolvedValue({});
    const createMany = jest.fn().mockResolvedValue({});
    const tx = {
      importRecord: { createMany },
      importRun: { update },
      $executeRaw: jest.fn().mockResolvedValue(0),
    };
    const transaction = jest.fn((action: (client: typeof tx) => unknown) =>
      action(tx),
    );
    const db = { $transaction: transaction } as unknown as CatalogDatabase;
    await stageLines(db, path, { id: 'run', checkpoint: 0 } as ImportRun);
    expect(transaction).toHaveBeenCalledTimes(2);
    expect(
      update.mock.calls.map(
        ([input]: [{ data: { checkpoint: number } }]) => input.data.checkpoint,
      ),
    ).toEqual([1, 2]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
