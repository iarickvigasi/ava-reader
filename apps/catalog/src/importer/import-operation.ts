import type { ImportRecord } from '#catalog-client';

export type ImportContext = {
  operation: string;
  kind: string;
  after?: string;
  runId?: string;
  recordId?: string;
  externalId?: string | null;
  batchFirstRecordId?: string;
  batchLastRecordId?: string;
  batchSize?: number;
  databaseOperation?: string;
  phase?: string;
  readId?: string;
};
export type ImportStep = <T>(
  operation: string,
  action: () => Promise<T>,
) => Promise<T>;
export type BulkRow = {
  id: string;
  record: ImportRecord;
  raw: Record<string, unknown>;
  incomplete: boolean;
};
export const directStep: ImportStep = (_, action) => action();

export function setImportPhase(
  context: ImportContext,
  phase: string,
  record?: ImportRecord,
) {
  context.phase = phase;
  context.recordId = record?.id;
  context.externalId = record?.externalId;
  context.databaseOperation = undefined;
}
