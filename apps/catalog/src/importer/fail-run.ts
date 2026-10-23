import type { CatalogDatabase } from '../database/catalog-database';
import { ChangedInput, RunStatus } from './types';

export async function failRun(db: CatalogDatabase, id: string, error: unknown) {
  const data = {
    status: RunStatus.FAILED,
    error:
      error instanceof Error ? error.message.slice(0, 500) : 'Staging failed',
  };
  if (error instanceof ChangedInput) {
    // A prefix from changed bytes is not a valid checkpoint for the original checksum.
    await db.$transaction([
      db.importRecord.deleteMany({ where: { runId: id } }),
      db.importRun.update({ where: { id }, data: { ...data, checkpoint: 0 } }),
    ]);
  } else await db.importRun.update({ where: { id }, data });
}
