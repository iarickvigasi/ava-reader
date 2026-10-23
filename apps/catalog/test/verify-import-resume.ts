import assert from 'node:assert/strict';
import { identifyFile } from '../src/importer/identify-file';
import { startRun } from '../src/importer/start-run';
import { stagedRow } from '../src/importer/staged-row';
import { failRun } from '../src/importer/fail-run';
import { ChangedInput } from '../src/importer/types';
import { stageFile } from '../src/importer/stage-file';
import { dumpLine, type ImportFixture } from './importer-fixtures';

export async function verifyImportResume(ctx: ImportFixture) {
  const rows = Array.from({ length: 101 }, () =>
    dumpLine(ctx.author, 'author', { name: 'Resume fixture' }),
  );
  const path = await ctx.file('resume', rows);
  const identity = await identifyFile(path);
  const run = await startRun(ctx.db, path, identity.checksum);
  // Persist the exact state left by one committed batch before a process interruption.
  await ctx.db.$transaction([
    ctx.db.importRecord.createMany({
      data: rows
        .slice(0, 100)
        .map((row, index) => stagedRow(run.id, index + 1, row)),
    }),
    ctx.db.importRun.update({
      where: { id: run.id },
      data: { checkpoint: 100 },
    }),
  ]);
  const completed = await stageFile(ctx.db, path);
  assert.equal(completed.checkpoint, 101);
  assert.equal(
    await ctx.db.importRecord.count({ where: { runId: run.id } }),
    101,
  );
  await stageFile(ctx.db, path);
  assert.equal(
    await ctx.db.importRecord.count({ where: { runId: run.id } }),
    101,
  );
  await failRun(ctx.db, run.id, new ChangedInput('Changed bytes'));
  assert.equal(
    (await ctx.db.importRun.findUniqueOrThrow({ where: { id: run.id } }))
      .checkpoint,
    0,
  );
  assert.equal(
    await ctx.db.importRecord.count({ where: { runId: run.id } }),
    0,
  );
  await stageFile(ctx.db, path);
  assert.equal(
    await ctx.db.importRecord.count({ where: { runId: run.id } }),
    101,
  );
  // Resume test only stages; do not apply its contradictory versions to the catalog.
  await ctx.db.importRun.delete({ where: { id: run.id } });
}
