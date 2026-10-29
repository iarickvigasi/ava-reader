import assert from 'node:assert/strict';
import { applyRecords } from '../src/importer/apply-records';
import { stageFile } from '../src/importer/stage-file';
import { dumpLine, type ImportFixture } from './importer-fixtures';

export async function verifyApplyTransactions(ctx: ImportFixture) {
  const original = await ctx.db.author.findUniqueOrThrow({
    where: { id: (await ctx.mapped(ctx.author)).authorId! },
  });
  const rows = Array.from({ length: 30 }, (_, index) =>
    dumpLine(
      ctx.author,
      'author',
      { name: `Batch author ${index}` },
      20 + index,
    ),
  );
  const run = await stageFile(ctx.db, await ctx.file('batch-success', rows));
  const records = await ctx.db.importRecord.findMany({
    where: { runId: run.id },
    orderBy: { line: 'asc' },
  });
  const metrics = await applyRecords(ctx.db, records, run.sourceId);
  assert.equal(metrics.transactions, 2);
  assert.equal(metrics.fallbackRecords, 0);
  assert.equal((await ctx.mapped(ctx.author)).sourceRevision, '49');
  const before = await ctx.db.catalogOutbox.count({
    where: { kind: 'AUTHOR' },
  });
  const failed = await stageFile(
    ctx.db,
    await ctx.file('batch-fallback', [
      dumpLine(ctx.author, 'author', { name: 'Committed valid author' }, 50),
      dumpLine(
        ctx.author,
        'author',
        { name: 'Must roll back', alternate_names: 'invalid' },
        51,
      ),
    ]),
  );
  const badRecords = await ctx.db.importRecord.findMany({
    where: { runId: failed.id },
    orderBy: { line: 'asc' },
  });
  const fallback = await applyRecords(ctx.db, badRecords, failed.sourceId);
  assert.equal(fallback.fallbackRecords, 2);
  assert.equal(fallback.transactions, 3);
  const mapping = await ctx.mapped(ctx.author);
  assert.equal(mapping.sourceRevision, '50');
  const author = await ctx.db.author.findUniqueOrThrow({
    where: { id: mapping.authorId! },
  });
  assert.equal(author.displayName, original.displayName);
  assert.equal(
    await ctx.db.catalogOutbox.count({ where: { kind: 'AUTHOR' } }),
    before + 1,
  );
  const statuses = await ctx.db.importRecord.findMany({
    where: { runId: failed.id },
    orderBy: { line: 'asc' },
  });
  assert.deepEqual(
    statuses.map((r) => r.status),
    ['CONFLICT', 'INVALID'],
  );
}
