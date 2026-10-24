import 'dotenv/config';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CatalogDatabase } from '../src/database/catalog-database';
import { fixture } from './importer-fixtures';
import { verifyImportLinks } from './verify-import-links';
import { verifyImportRevisions } from './verify-import-revisions';
import { verifyImportResume } from './verify-import-resume';
import { verifySlowStaging } from './verify-slow-staging';
import { verifyImportFailures } from './verify-import-failures';
import { cleanupImportFixtures } from './cleanup-import-fixtures';

async function integration() {
  const db = new CatalogDatabase();
  const directory = await mkdtemp(join(tmpdir(), 'ava-import-'));
  const ctx = fixture(db, directory);
  try {
    await verifyImportLinks(ctx);
    await verifyImportRevisions(ctx);
    await verifyImportResume(ctx);
    await verifySlowStaging(ctx);
    await verifyImportFailures(ctx);
    console.log(
      'Importer integration passed: links, gzip, replay, revision guards, resume, quarantine, lock.',
    );
  } finally {
    try {
      await cleanupImportFixtures(ctx);
    } finally {
      await db.$disconnect();
      await rm(directory, { recursive: true, force: true });
    }
  }
}
integration().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
