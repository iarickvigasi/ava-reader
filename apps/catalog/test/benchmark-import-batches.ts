import { measureImportBatch } from './measure-import-batch';
import 'dotenv/config';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CatalogDatabase } from '../src/database/catalog-database';
import { fixture } from './importer-fixtures';
import { cleanupImportFixtures } from './cleanup-import-fixtures';

async function benchmark() {
  if (
    new URL(process.env.CATALOG_DATABASE_URL ?? '').pathname !==
    '/ava_import_benchmark'
  )
    throw new Error(
      'Benchmark requires a disposable database named ava_import_benchmark',
    );
  const directory = await mkdtemp(join(tmpdir(), 'ava-import-benchmark-'));
  const db = new CatalogDatabase(60000),
    ctx = fixture(db, directory);
  try {
    for (const round of [1, 2]) {
      for (const size of round === 1
        ? [25, 50, 100, 250]
        : [250, 100, 50, 25]) {
        for (const kind of ['AUTHOR', 'WORK', 'EDITION'] as const)
          await measureImportBatch(ctx, kind, size, round);
      }
    }
  } finally {
    await cleanupImportFixtures(ctx);
    await db.$disconnect();
    await rm(directory, { recursive: true, force: true });
  }
}

benchmark().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
