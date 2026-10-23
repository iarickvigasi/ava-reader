import { RecordStatus } from './types';
import type { Prisma } from '#catalog-client';
import { parseRecord } from './parse-record';

export function stagedRow(
  runId: string,
  line: number,
  raw: string | null,
): Prisma.ImportRecordCreateManyInput {
  try {
    return { runId, line, ...parseRecord(raw) };
  } catch (error) {
    return {
      runId,
      line,
      status: RecordStatus.INVALID,
      diagnostic:
        error instanceof Error ? error.message.slice(0, 500) : 'Invalid record',
    };
  }
}
