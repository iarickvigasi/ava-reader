import assert from 'node:assert/strict';
import { runImport } from '../src/importer/run-import';
import { dumpLine, type ImportFixture } from './importer-fixtures';

export async function verifyImportRevisions(ctx: ImportFixture) {
  const revision = await ctx.file('newer', [
    dumpLine(ctx.work, 'work', { title: 'Newer title' }, 3),
  ]);
  await runImport(ctx.db, revision);
  const mapping = await ctx.mapped(ctx.work);
  const id = mapping.workId!;
  assert.equal(
    (await ctx.db.work.findUniqueOrThrow({ where: { id } })).originalTitle,
    'Fixture work',
  );
  const older = await ctx.file('older', [
    dumpLine(ctx.work, 'work', { title: 'Stale title' }, 2),
  ]);
  assert.equal((await runImport(ctx.db, older)).counts.SKIPPED, 1);
  const clash = await ctx.file('clash', [
    dumpLine(ctx.work, 'work', { title: 'Conflicting title' }, 3),
  ]);
  assert.equal((await runImport(ctx.db, clash)).counts.CONFLICT, 1);
  assert.equal(
    (await ctx.db.work.findUniqueOrThrow({ where: { id } })).originalTitle,
    'Fixture work',
  );
  // Missing fields must preserve accepted relationships and text.
  assert.equal(await ctx.db.workCredit.count({ where: { workId: id } }), 1);
  assert.equal(
    (await ctx.db.workText.findFirstOrThrow({ where: { workId: id } }))
      .description,
    'Source description',
  );
  await ctx.db.work.update({
    where: { id },
    data: {
      originalTitle: 'Curated title',
      revision: { increment: 1 },
    },
  });
  const afterEdit = await ctx.file('curated', [
    dumpLine(ctx.work, 'work', { title: 'Provider edit' }, 4),
  ]);
  assert.equal((await runImport(ctx.db, afterEdit)).counts.CONFLICT, 1);
  assert.equal(
    (await ctx.db.work.findUniqueOrThrow({ where: { id } })).originalTitle,
    'Curated title',
  );
}
