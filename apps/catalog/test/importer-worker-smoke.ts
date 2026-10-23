import 'dotenv/config';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { CatalogDatabase } from '../src/database/catalog-database';
import { fixture, dumpLine } from './importer-fixtures';
import { cleanupImportFixtures } from './cleanup-import-fixtures';

async function smoke() {
  const directory = await mkdtemp(join(tmpdir(), 'ava-worker-'));
  const db = new CatalogDatabase();
  const ctx = fixture(db, directory);
  const url = new URL(process.env.CATALOG_DATABASE_URL!);
  // This check targets the local Compose DB, exposed to the host on a different port.
  url.hostname = 'catalog-postgres';
  url.port = '5432';
  const env = {
    ...process.env,
    CATALOG_IMPORT_DIRECTORY: directory,
    CATALOG_DATABASE_URL: url.toString(),
  };
  const execute = promisify(execFile);
  const run = (file: string) =>
    execute(
      'docker',
      [
        'compose',
        '--profile',
        'import',
        'run',
        '--rm',
        '--no-deps',
        'catalog-importer',
        '--file',
        `/imports/${basename(file)}`,
      ],
      { env, encoding: 'utf8', timeout: 120000 },
    );
  try {
    const path = await ctx.file(
      'worker',
      [
        dumpLine(ctx.author, 'author', { name: 'Worker fixture author' }),
        dumpLine(ctx.work, 'work', {
          title: 'Worker fixture work',
          authors: [{ author: { key: ctx.author } }],
        }),
        dumpLine(ctx.edition, 'edition', {
          title: 'Worker fixture edition',
          works: [{ key: ctx.work }],
        }),
      ],
      true,
    );
    assert.match((await run(path)).stdout, /"APPLIED": 3/);
    const work = await ctx.mapped(ctx.work);
    const edition = await ctx.mapped(ctx.edition);
    assert.equal(
      (
        await db.edition.findUniqueOrThrow({
          where: { id: edition.editionId! },
        })
      ).workId,
      work.workId,
    );
    assert.match((await run(path)).stdout, /"APPLIED": 3/);
    assert.equal(
      await db.catalogOutbox.count({ where: { entityId: work.workId! } }),
      1,
    );
    const invalid = await ctx.file('worker-invalid', ['invalid TSV']);
    await assert.rejects(
      run(invalid),
      (error: unknown) =>
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 2,
    );
    console.log(
      'Docker importer passed: mounted gzip, linked metadata, replay, and invalid-record exit code.',
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
smoke().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
