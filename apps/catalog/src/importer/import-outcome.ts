import { RecordStatus } from './types';
export function importOutcome(incomplete: boolean, conflicts: string[]) {
  return {
    status: incomplete
      ? RecordStatus.UNRESOLVED
      : conflicts.length
        ? RecordStatus.CONFLICT
        : RecordStatus.APPLIED,
    diagnostic: conflicts.length
      ? `Enriched; preserved conflicting fields: ${[...new Set(conflicts)].join(', ')}${incomplete ? '; missing author references' : ''}`.slice(
          0,
          500,
        )
      : incomplete
        ? 'Published; missing author references'
        : null,
  };
}
