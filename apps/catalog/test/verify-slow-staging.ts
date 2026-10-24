import assert from 'node:assert/strict';
import { stageFile } from '../src/importer/stage-file';
import { dumpLine, type ImportFixture } from './importer-fixtures';

export async function verifySlowStaging(ctx: ImportFixture) {
  const path = await ctx.file('slow-staging', [
    dumpLine(ctx.author, 'author', { name: 'Slow fixture' }),
  ]);
  await ctx.db.$executeRawUnsafe(`
    CREATE FUNCTION ava_import_staging_delay() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.line = 2 THEN RAISE EXCEPTION 'Fixture batch failure'; END IF;
      PERFORM pg_sleep(6);
      RETURN NEW;
    END $$`);
  try {
    await ctx.db.$executeRawUnsafe(`
      CREATE TRIGGER ava_import_staging_delay BEFORE INSERT ON "ImportRecord"
      FOR EACH ROW EXECUTE FUNCTION ava_import_staging_delay()`);
    const run = await stageFile(ctx.db, path);
    assert.equal(run.checkpoint, 1);
    assert.equal(
      await ctx.db.importRecord.count({ where: { runId: run.id } }),
      1,
    );
    const settings = await ctx.db.$queryRaw<{ timeout: string }[]>`
      SELECT current_setting('statement_timeout') AS timeout`;
    assert.equal(settings[0].timeout, '5s');

    const failedPath = await ctx.file('slow-rollback', [
      dumpLine(ctx.author, 'author', { name: 'Rollback fixture' }),
      dumpLine(ctx.author, 'author', { name: 'Must fail' }),
    ]);
    await assert.rejects(
      stageFile(ctx.db, failedPath),
      /Fixture batch failure/,
    );
    const failed = await ctx.db.importRun.findFirstOrThrow({
      where: { filename: `${ctx.prefix}-slow-rollback.txt` },
    });
    assert.equal(failed.checkpoint, 0);
    assert.equal(
      await ctx.db.importRecord.count({ where: { runId: failed.id } }),
      0,
    );
    await ctx.db.$executeRawUnsafe(
      'DROP TRIGGER ava_import_staging_delay ON "ImportRecord"',
    );
    const resumed = await stageFile(ctx.db, failedPath);
    assert.equal(resumed.checkpoint, 2);
    assert.equal(
      await ctx.db.importRecord.count({ where: { runId: failed.id } }),
      2,
    );
    await ctx.db.importRun.deleteMany({
      where: { id: { in: [run.id, failed.id] } },
    });
  } finally {
    await ctx.db.$executeRawUnsafe(
      'DROP TRIGGER IF EXISTS ava_import_staging_delay ON "ImportRecord"',
    );
    await ctx.db.$executeRawUnsafe('DROP FUNCTION ava_import_staging_delay()');
  }
}
