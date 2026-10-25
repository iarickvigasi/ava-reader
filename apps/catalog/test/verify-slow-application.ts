import assert from 'node:assert/strict';
import { CatalogDatabase } from '../src/database/catalog-database';
import { runImport } from '../src/importer/run-import';
import { dumpLine, type ImportFixture } from './importer-fixtures';

export async function verifySlowApplication(ctx: ImportFixture) {
  const importer = new CatalogDatabase(60_000);
  try {
    const settings = await importer.$queryRaw<{ timeout: string }[]>`
      SELECT current_setting('statement_timeout') AS timeout`;
    assert.equal(settings[0].timeout, '1min');
  } finally {
    await importer.$disconnect();
  }
  const path = await ctx.file('slow-application', [
    dumpLine(ctx.author, 'author', { name: 'Slow author' }, 10),
  ]);
  // Sequences survive rollback: cancel after the author write once, then succeed.
  await ctx.db.$executeRawUnsafe('CREATE SEQUENCE ava_apply_attempt');
  await ctx.db.$executeRawUnsafe(`
    CREATE FUNCTION ava_apply_delay() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF nextval('ava_apply_attempt') = 1 THEN
        RAISE EXCEPTION 'Fixture statement timeout' USING ERRCODE = '57014';
      END IF;
      PERFORM pg_sleep(6);
      RETURN NEW;
    END $$`);
  try {
    await ctx.db.$executeRawUnsafe(`
      CREATE TRIGGER ava_apply_delay AFTER INSERT ON "CatalogOutbox"
      FOR EACH ROW EXECUTE FUNCTION ava_apply_delay()`);
    await runImport(ctx.db, path);
    const mapping = await ctx.mapped(ctx.author);
    assert.equal(mapping.sourceRevision, '10');
    assert.equal(
      await ctx.db.catalogOutbox.count({
        where: { kind: 'AUTHOR', entityId: mapping.authorId! },
      }),
      2,
    ); // Initial fixture revision plus exactly one accepted update.
    const rows = await ctx.db.$queryRaw<{ timeout: string }[]>`
      SELECT current_setting('statement_timeout') AS timeout`;
    assert.equal(rows[0].timeout, '5s');
  } finally {
    await ctx.db.$executeRawUnsafe(
      'DROP TRIGGER IF EXISTS ava_apply_delay ON "CatalogOutbox"',
    );
    await ctx.db.$executeRawUnsafe('DROP FUNCTION ava_apply_delay()');
    await ctx.db.$executeRawUnsafe('DROP SEQUENCE ava_apply_attempt');
  }
}
