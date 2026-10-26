import type { ImportRecord } from '#catalog-client';
import { applyRecord } from './apply-record';
import { applyNewBatch } from './apply-new-batch';
import {
  setImportPhase,
  type ImportContext,
  type ImportStep,
} from './import-operation';
import type { ApplyMetrics } from './apply-transaction';
import type { Tx } from './types';

export async function applyTransactionRecords(
  tx: Tx,
  records: ImportRecord[],
  sourceId: string,
  metrics: ApplyMetrics,
  context: ImportContext,
) {
  setImportPhase(context, 'bulk');
  const step: ImportStep = (operation, action) => {
    context.databaseOperation = operation;
    return action();
  };
  const started = performance.now();
  try {
    const bulk = await applyNewBatch(tx, records, sourceId, step);
    for (const record of bulk.remaining) {
      setImportPhase(context, 'record', record);
      await applyRecord(tx, record, sourceId);
    }
    setImportPhase(context, 'commit');
    context.databaseOperation = 'commit';
    return bulk.count;
  } finally {
    metrics.recordWriteMs += performance.now() - started;
  }
}
