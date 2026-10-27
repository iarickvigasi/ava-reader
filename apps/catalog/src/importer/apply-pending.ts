import { batchSettings } from './batch-settings';
import { recordBytes } from './record-groups';
import type { CatalogDatabase } from '../database/catalog-database';
import type { ImportContext } from './import-operation';
import { retryDatabaseOperation } from './retry-database-operation';
import { readApplyBatch } from './read-apply-batch';
import { applyRecords } from './apply-records';
import { RunStatus, KINDS, SOURCE_KEY } from './types';

export async function applyPending(db: CatalogDatabase) {
  const settings = batchSettings();
  console.log(JSON.stringify({ event: 'importSettings', ...settings }));
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
        const context: ImportContext = {
          operation: 'readApplyBatch',
          kind,
          runId: run.id,
          after,
        };
        const records = await retryDatabaseOperation(context, () =>
          readApplyBatch(db, { runId: run.id, kind, after }, context, settings),
        );
        if (!records.length) break;
        const readMs = performance.now() - readStarted;
        const applyStarted = performance.now();
        const metrics = await applyRecords(db, records, source.id, settings);
        const applyMs = performance.now() - applyStarted;
        console.log(
          JSON.stringify({
            event: 'importBatch',
            kind,
            runId: run.id,
            after,
            records: records.length,
            payloadBytes: records.reduce(
              (sum, row) => sum + recordBytes(row),
              0,
            ),
            rssBytes: process.memoryUsage().rss,
            heapUsedBytes: process.memoryUsage().heapUsed,
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
