import type { CatalogDatabase } from '../database/catalog-database';
import { retryDatabaseOperation } from './retry-database-operation';
import { readApplyBatch } from './read-apply-batch';
import { applyRecord } from './apply-record';
import {
  RecordStatus,
  RunStatus,
  IMPORT_STATEMENT_TIMEOUT_MS,
  IMPORT_TRANSACTION_TIMEOUT_MS,
  KINDS,
  SOURCE_KEY,
  InvalidRecord,
  UnresolvedRecord,
  ConflictingRecord,
} from './types';

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
        const records = await retryDatabaseOperation(
          { operation: 'readApplyBatch', kind, runId: run.id, after },
          () => readApplyBatch(db, { runId: run.id, kind, after }),
        );
        if (!records.length) break;
        for (const record of records) {
          try {
            await retryDatabaseOperation(
              {
                operation: 'applyRecord',
                kind,
                runId: record.runId,
                recordId: record.id,
                externalId: record.externalId,
              },
              () =>
                db.$transaction(
                  async (tx) => {
                    await tx.$executeRaw`SELECT set_config('statement_timeout', ${String(IMPORT_STATEMENT_TIMEOUT_MS)}, true)`;
                    await applyRecord(tx, record, source.id);
                  },
                  { maxWait: 10000, timeout: IMPORT_TRANSACTION_TIMEOUT_MS },
                ),
            );
          } catch (error) {
            const status =
              error instanceof UnresolvedRecord
                ? RecordStatus.UNRESOLVED
                : error instanceof ConflictingRecord
                  ? RecordStatus.CONFLICT
                  : error instanceof InvalidRecord
                    ? RecordStatus.INVALID
                    : undefined;
            if (!status) throw error;
            await db.importRecord.update({
              where: { id: record.id },
              data: {
                status,
                diagnostic: (error as Error).message.slice(0, 500),
              },
            });
          }
        }
        after = records[records.length - 1].id;
      }
    }
  }
}
