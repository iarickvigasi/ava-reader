import { basename } from 'node:path';
import type { CatalogDatabase } from '../database/catalog-database';
import { RunStatus, ADAPTER_VERSION, SOURCE_KEY } from './types';

export async function startRun(
  db: CatalogDatabase,
  filename: string,
  checksum: string,
) {
  const source = await db.source.upsert({
    where: { key: SOURCE_KEY },
    update: {},
    create: { key: SOURCE_KEY, name: 'Open Library' },
  });
  const run = await db.importRun.upsert({
    where: {
      checksum_adapterVersion: {
        checksum,
        adapterVersion: ADAPTER_VERSION,
      },
    },
    update: {},
    create: {
      sourceId: source.id,
      checksum,
      adapterVersion: ADAPTER_VERSION,
      filename: basename(filename),
    },
  });
  if (run.status !== RunStatus.STAGED)
    await db.importRun.update({
      where: { id: run.id },
      data: { status: RunStatus.STAGING, error: null },
    });
  return run;
}
