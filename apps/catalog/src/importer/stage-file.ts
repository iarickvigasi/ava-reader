import { RunStatus, ChangedInput } from './types';
import { failRun } from './fail-run';
import { stat } from 'node:fs/promises';
import type { CatalogDatabase } from '../database/catalog-database';
import { identifyFile } from './identify-file';
import { startRun } from './start-run';
import { stageLines } from './stage-lines';

export async function stageFile(db: CatalogDatabase, filename: string) {
  const identity = await identifyFile(filename);
  const run = await startRun(db, filename, identity.checksum);
  if (run.status === RunStatus.STAGED) return run;
  try {
    await stageLines(db, filename, run);
    const after = await stat(filename);
    if (after.size !== identity.size || after.mtimeMs !== identity.mtime) {
      throw new ChangedInput(
        'Input changed during staging; restart with an immutable file',
      );
    }
    return await db.importRun.update({
      where: { id: run.id },
      data: { status: RunStatus.STAGED },
    });
  } catch (error) {
    await failRun(db, run.id, error);
    throw error;
  }
}
