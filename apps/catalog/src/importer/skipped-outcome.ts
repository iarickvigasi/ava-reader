import type { ImportRecord } from '#catalog-client';
import { RecordStatus } from './types';
export function skippedOutcome(record: ImportRecord, incomplete?: boolean) {
  const conflict = record.diagnostic?.startsWith(
    'Enriched; preserved conflicting fields:',
  );
  return {
    status:
      incomplete === undefined
        ? RecordStatus.SKIPPED
        : incomplete
          ? RecordStatus.UNRESOLVED
          : conflict
            ? RecordStatus.CONFLICT
            : RecordStatus.APPLIED,
    diagnostic: conflict
      ? record.diagnostic
      : incomplete
        ? 'Published; missing author references'
        : null,
  };
}
