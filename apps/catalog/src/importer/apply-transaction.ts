import type { ImportRecord } from '#catalog-client';
import type { CatalogDatabase } from '../database/catalog-database';
import { applyTransactionRecords } from './apply-transaction-records';
import { setImportPhase, type ImportContext } from './import-operation';
import { retryDatabaseOperation } from './retry-database-operation';
import {
  IMPORT_STATEMENT_TIMEOUT_MS,
  IMPORT_TRANSACTION_TIMEOUT_MS,
} from './types';

export type ApplyMetrics = {
  transactions: number;
  bulkRecords: number;
  fallbackRecords: number;
  transactionMs: number;
  recordWriteMs: number;
};

export async function applyTransaction(
  db: CatalogDatabase,
  records: ImportRecord[],
  sourceId: string,
  metrics: ApplyMetrics,
) {
  const first = records[0];
  const context: ImportContext = {
    operation: records.length === 1 ? 'applyRecord' : 'applyTransaction',
    kind: first.kind!,
    runId: first.runId,
    batchFirstRecordId: first.id,
    batchLastRecordId: records[records.length - 1].id,
    batchSize: records.length,
  };
  await retryDatabaseOperation(context, async () => {
    metrics.transactions++;
    const started = performance.now();
    setImportPhase(context, 'transaction');
    try {
      const bulkCount = await db.$transaction(
        async (tx) => {
          context.databaseOperation = 'setStatementTimeout';
          await tx.$executeRaw`SELECT set_config('statement_timeout', ${String(IMPORT_STATEMENT_TIMEOUT_MS)}, true)`;
          return applyTransactionRecords(
            tx,
            records,
            sourceId,
            metrics,
            context,
          );
        },
        { maxWait: 10000, timeout: IMPORT_TRANSACTION_TIMEOUT_MS },
      );
      metrics.bulkRecords += bulkCount;
    } finally {
      metrics.transactionMs += performance.now() - started;
    }
  });
}
