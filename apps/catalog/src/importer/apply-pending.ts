import type { CatalogDatabase } from '../database/catalog-database';
import { retryDatabaseOperation } from './retry-database-operation';
import { readApplyBatch } from './read-apply-batch';
import { applyRecords } from './apply-records';
import { RunStatus, KINDS, SOURCE_KEY } from './types';

export async function applyPending(db: CatalogDatabase) {
  const source = await db.source.findUnique({ where: { key: SOURCE_KEY } });
  if (!source) return;
  const runs = await db.importRun.findMany({
    where: { sourceId: source.id, status: RunStatus.STAGED },
    select: { id: true },
    orderBy: { id: 'asc' },
  });
  for (const kind of KINDS) {
    for (const run of runs) {
      let after: string | undefined;
      while (true) {
        const readStarted = performance.now();
        const records = await retryDatabaseOperation(
          { operation: 'readApplyBatch', kind, runId: run.id, after },
          () => readApplyBatch(db, { runId: run.id, kind, after }),
        );
        if (!records.length) break;
        const readMs = performance.now() - readStarted;
        const applyStarted = performance.now();
        const metrics = await applyRecords(db, records, source.id);
        const applyMs = performance.now() - applyStarted;
        console.log(
          JSON.stringify({
            event: 'importBatch',
            kind,
            runId: run.id,
            after,
            records: records.length,
            readMs,
            applyMs,
            ...metrics,
            recordsPerSecond: (records.length * 1000) / (readMs + applyMs),
          }),
        );
        after = records[records.length - 1].id;
      }
    }
  }
}
