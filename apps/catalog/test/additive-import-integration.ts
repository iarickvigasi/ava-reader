import 'dotenv/config';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CatalogDatabase } from '../src/database/catalog-database';
import { fixture } from './importer-fixtures';
import { cleanupImportFixtures } from './cleanup-import-fixtures';
import { verifyAdditiveReimport } from './verify-additive-reimport';
async function main() {
  const db = new CatalogDatabase();
  const directory = await mkdtemp(join(tmpdir(), 'ava-additive-'));
  const ctx = fixture(db, directory);
  try {
    await verifyAdditiveReimport(ctx);
    console.log('Additive reimport integration passed');
  } finally {
    await cleanupImportFixtures(ctx);
    await db.$disconnect();
    await rm(directory, { recursive: true, force: true });
  }
}
void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
