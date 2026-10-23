import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { runImport } from '../src/importer/run-import';
import { withImportLock } from '../src/importer/with-import-lock';
import { dumpLine, type ImportFixture } from './importer-fixtures';

export async function verifyImportFailures(ctx: ImportFixture) {
  const bad = await ctx.file('invalid', [
    'not TSV',
    dumpLine(
      ctx.edition,
      'edition',
      {
        title: 'No work reference',
        works: [],
      },
      2,
    ),
    dumpLine(
      ctx.edition,
      'edition',
      {
        title: 'Must roll back',
        works: [{ key: ctx.work }],
        isbn_10: 'wrong type',
      },
      3,
    ),
  ]);
  const result = await runImport(ctx.db, bad);
  assert.equal(result.counts.INVALID, 2);
  assert.equal(result.counts.UNRESOLVED, 1);
  // Unresolved update must not leave a partial edition or move its existing work link.
  const mapping = await ctx.mapped(ctx.edition);
  assert.equal(mapping.sourceRevision, '1');
  assert.equal(
    (
      await ctx.db.edition.findUniqueOrThrow({
        where: { id: mapping.editionId! },
      })
    ).title,
    'Fixture edition',
  );
  const corrupt = await ctx.file('corrupt', [], true);
  await writeFile(corrupt, 'invalid gzip bytes');
  await assert.rejects(runImport(ctx.db, corrupt));
  const failed = await ctx.db.importRun.findFirstOrThrow({
    where: { filename: `${ctx.prefix}-corrupt.txt.gz` },
  });
  assert.equal(failed.status, 'FAILED');
  await withImportLock(async () => {
    await assert.rejects(runImport(ctx.db), /Another catalog importer/);
  });
}
