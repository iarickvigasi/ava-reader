import type { ImportRecord } from '#catalog-client';
import type { CatalogDatabase } from '../database/catalog-database';
import { applyTransaction, type ApplyMetrics } from './apply-transaction';
import { batchSettings, type BatchSettings } from './batch-settings';
import { recordGroups } from './record-groups';
import {
  ConflictingRecord,
  InvalidRecord,
  RecordStatus,
  UnresolvedRecord,
} from './types';

export async function applyRecords(
  db: CatalogDatabase,
  records: ImportRecord[],
  sourceId: string,
  settings: BatchSettings = batchSettings(),
) {
  const metrics: ApplyMetrics = {
    transactions: 0,
    bulkRecords: 0,
    fallbackRecords: 0,
    transactionMs: 0,
    recordWriteMs: 0,
  };
  for (const group of recordGroups(
    records,
    settings.transactionSize,
    settings.transactionBytes,
  )) {
    try {
      await applyTransaction(db, group, sourceId, metrics);
    } catch (error) {
      if (group.length === 1) {
        await quarantine(db, group[0], error);
        continue;
      }
      // The entire group rolled back. Replay individually so one bad row cannot hide good rows.
      metrics.fallbackRecords += group.length;
      for (const record of group) {
        try {
          await applyTransaction(db, [record], sourceId, metrics);
        } catch (recordError) {
          await quarantine(db, record, recordError);
        }
      }
    }
  }
  return metrics;
}

async function quarantine(
  db: CatalogDatabase,
  record: ImportRecord,
  error: unknown,
) {
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
    data: { status, diagnostic: (error as Error).message.slice(0, 500) },
  });
}
