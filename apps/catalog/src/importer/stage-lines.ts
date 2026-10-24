import type { ImportRun, Prisma } from '#catalog-client';
import type { CatalogDatabase } from '../database/catalog-database';
import { readLines } from './read-lines';
import { commitStageBatch } from './commit-stage-batch';
import { stagedRow } from './staged-row';
import { STAGE_BATCH_SIZE, MAX_STAGE_BATCH_BYTES } from './types';

export async function stageLines(
  db: CatalogDatabase,
  filename: string,
  run: ImportRun,
) {
  let line = 0;
  let bytes = 0;
  let batch: Prisma.ImportRecordCreateManyInput[] = [];
  const flush = async () => {
    if (!batch.length) return;
    await commitStageBatch(db, run.id, batch);
    batch = [];
    bytes = 0;
  };
  for await (const raw of readLines(filename)) {
    line++;
    if (line <= run.checkpoint) continue;
    const size = raw === null ? 0 : Buffer.byteLength(raw);
    if (batch.length && bytes + size > MAX_STAGE_BATCH_BYTES) await flush();
    batch.push(stagedRow(run.id, line, raw));
    bytes += size;
    if (batch.length >= STAGE_BATCH_SIZE || bytes >= MAX_STAGE_BATCH_BYTES)
      await flush();
  }
  await flush();
}
