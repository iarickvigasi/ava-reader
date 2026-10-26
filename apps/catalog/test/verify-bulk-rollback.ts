import assert from 'node:assert/strict';
import { applyRecords } from '../src/importer/apply-records';
import { bulkAuthorFixture } from './bulk-author-fixture';
import type { ImportFixture } from './importer-fixtures';

export async function verifyBulkRollback(ctx: ImportFixture) {
  const fixture = await bulkAuthorFixture(ctx);
  await ctx.db.$executeRawUnsafe('CREATE SEQUENCE ava_bulk_attempt');
  await ctx.db
    .$executeRawUnsafe(`CREATE FUNCTION ava_bulk_cancel() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF nextval('ava_bulk_attempt') = 1 THEN
        RAISE EXCEPTION 'Fixture bulk timeout' USING ERRCODE = '57014';
      END IF;
      RETURN NEW;
    END $$`);
  try {
    await ctx.db.$executeRawUnsafe(
      'CREATE TRIGGER ava_bulk_cancel AFTER INSERT ON "CatalogOutbox" FOR EACH ROW EXECUTE FUNCTION ava_bulk_cancel()',
    );
    const authorsBefore = await ctx.db.author.count();
    // Failure happens after bulk author/alias/text/mapping writes; all must roll back before retry.
    const result = await applyRecords(
      ctx.db,
      fixture.records,
      fixture.sourceId,
    );
    assert.equal(result.transactions, 2);
    assert.equal(result.bulkRecords, 3);
    assert.equal(await ctx.db.author.count(), authorsBefore + 3);
    const mappings = await ctx.db.sourceMapping.findMany({
      where: { sourceId: fixture.sourceId, externalId: { in: fixture.keys } },
    });
    assert.equal(mappings.length, 3);
    assert.equal(
      await ctx.db.catalogOutbox.count({
        where: { entityId: { in: mappings.map((row) => row.authorId!) } },
      }),
      3,
    );
  } finally {
    await ctx.db.$executeRawUnsafe(
      'DROP TRIGGER IF EXISTS ava_bulk_cancel ON "CatalogOutbox"',
    );
    await ctx.db.$executeRawUnsafe('DROP FUNCTION ava_bulk_cancel()');
    await ctx.db.$executeRawUnsafe('DROP SEQUENCE ava_bulk_attempt');
    await fixture.cleanup();
  }
}
