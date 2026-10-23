import type { CatalogDatabase } from '../database/catalog-database';
import { withImportLock } from './with-import-lock';
import { stageFile } from './stage-file';
import { applyPending } from './apply-pending';
import { RunStatus, SOURCE_KEY } from './types';

export async function runImport(db: CatalogDatabase, filename?: string) {
  return withImportLock(async () => {
    await db.$connect();
    const run = filename ? await stageFile(db, filename) : undefined;
    await applyPending(db);
    const records = await db.importRecord.groupBy({
      by: ['status'],
      where: run
        ? { runId: run.id }
        : { run: { source: { key: SOURCE_KEY }, status: RunStatus.STAGED } },
      _count: true,
    });
    return {
      runId: run?.id ?? null,
      checkpoint: run?.checkpoint ?? null,
      counts: Object.fromEntries(
        records.map((row) => [row.status, row._count]),
      ),
    };
  });
}
