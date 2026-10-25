import assert from 'node:assert/strict';
import { seedApplyRecords } from './seed-apply-records';
import { stageFile } from '../src/importer/stage-file';
import { readApplyBatch } from '../src/importer/read-apply-batch';
import { dumpLine, type ImportFixture } from './importer-fixtures';

export async function verifyApplySelection(ctx: ImportFixture) {
  const path = await ctx.file('selection', [
    dumpLine(ctx.author, 'author', { name: 'Selection fixture' }),
  ]);
  const run = await stageFile(ctx.db, path);
  const other = await stageFile(
    ctx.db,
    await ctx.file('other-selection', [
      dumpLine(ctx.author, 'author', { name: 'Other selection fixture' }),
    ]),
  );
  try {
    await ctx.db.importRecord.deleteMany({ where: { runId: run.id } });
    await seedApplyRecords(ctx.db, run.id);
    await ctx.db.importRecord.deleteMany({ where: { runId: other.id } });
    await seedApplyRecords(ctx.db, other.id);
    const first = await readApplyBatch(ctx.db, {
      runId: run.id,
      kind: 'AUTHOR',
    });
    assert.equal(first.length, 50);
    assert.ok(first.every((row) => row.status !== 'APPLIED'));
    const expected = await ctx.db.importRecord.findMany({
      where: {
        runId: run.id,
        kind: 'AUTHOR',
        status: { in: ['PENDING', 'UNRESOLVED'] },
      },
      select: { id: true },
      orderBy: { id: 'asc' },
      take: 50,
    });
    assert.deepEqual(
      first.map((row) => row.id),
      expected.map((row) => row.id),
    );
    // Keep every returned row unresolved: the shared cursor must still advance past it.
    await ctx.db.importRecord.updateMany({
      where: { id: { in: first.map((row) => row.id) } },
      data: { status: 'UNRESOLVED' },
    });
    const otherPage = await readApplyBatch(ctx.db, {
      runId: other.id,
      kind: 'AUTHOR',
    });
    assert.equal(otherPage.length, 50);
    assert.equal(otherPage[0].runId, other.id);
    const after = first[49].id;
    const next = await readApplyBatch(ctx.db, {
      runId: run.id,
      kind: 'AUTHOR',
      after,
    });
    assert.equal(next.length, 50);
    assert.ok(next.every((row) => row.id > after && row.runId === run.id));
    assert.equal(
      (await readApplyBatch(ctx.db, { runId: run.id, kind: 'WORK' })).length,
      0,
    );
    const resumed = await readApplyBatch(ctx.db, {
      runId: run.id,
      kind: 'AUTHOR',
    });
    assert.deepEqual(
      resumed.map((row) => row.id),
      first.map((row) => row.id),
    );
    for (const status of ['PENDING', 'UNRESOLVED']) {
      const plans = await ctx.db.$queryRawUnsafe<{ 'QUERY PLAN': unknown }[]>(
        `
        EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
        SELECT id FROM "ImportRecord"
        WHERE "runId" = $1::uuid AND kind = 'AUTHOR'
          AND status = $2::"ImportRecordStatus" AND id > $3::uuid
        ORDER BY id LIMIT 50`,
        run.id,
        status,
        after,
      );
      const plan = JSON.stringify(plans[0]['QUERY PLAN']);
      assert.match(plan, /"Node Type":"Index( Only)? Scan"/);
      console.log(`Selection plan ${status}: ${plan}`);
      assert.ok(!plan.includes('"Node Type":"Sort"'), plan);
    }
  } finally {
    await ctx.db.importRun.deleteMany({
      where: { id: { in: [run.id, other.id] } },
    });
  }
}
