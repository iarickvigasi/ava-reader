import type { CatalogDatabase } from '../database/catalog-database';
import { applyRecord } from './apply-record';
import {
  RecordStatus,
  RunStatus,
  APPLY_BATCH_SIZE,
  KINDS,
  SOURCE_KEY,
  InvalidRecord,
  UnresolvedRecord,
  ConflictingRecord,
} from './types';

export async function applyPending(db: CatalogDatabase) {
  const source = await db.source.findUnique({ where: { key: SOURCE_KEY } });
  if (!source) return;
  for (const kind of KINDS) {
    let after: string | undefined;
    while (true) {
      const records = await db.importRecord.findMany({
        where: {
          kind,
          status: { in: [RecordStatus.PENDING, RecordStatus.UNRESOLVED] },
          run: { sourceId: source.id, status: RunStatus.STAGED },
          ...(after ? { id: { gt: after } } : {}),
        },
        orderBy: { id: 'asc' },
        take: APPLY_BATCH_SIZE,
      });
      if (!records.length) break;
      for (const record of records) {
        try {
          await db.$transaction((tx) => applyRecord(tx, record, source.id), {
            maxWait: 10000,
            timeout: 15000,
          });
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
