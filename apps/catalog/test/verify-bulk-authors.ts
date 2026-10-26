import assert from 'node:assert/strict';
import { applyRecords } from '../src/importer/apply-records';
import { bulkAuthorFixture } from './bulk-author-fixture';
import type { ImportFixture } from './importer-fixtures';

export async function verifyBulkAuthors(ctx: ImportFixture) {
  const fixture = await bulkAuthorFixture(ctx);
  try {
    const { records, sourceId, keys } = fixture;
    const result = await applyRecords(ctx.db, records, sourceId);
    assert.equal(result.bulkRecords, 3);
    assert.equal(result.transactions, 1);
    const mappings = await ctx.db.sourceMapping.findMany({
      where: { sourceId, externalId: { in: keys } },
    });
    const ids = mappings.map((row) => row.authorId!);
    assert.equal(ids.length, 3);
    assert.equal(
      await ctx.db.authorAlias.count({ where: { authorId: { in: ids } } }),
      3,
    );
    assert.equal(
      await ctx.db.authorText.count({
        where: { authorId: { in: ids }, locale: 'und', biography: 'Biography' },
      }),
      3,
    );
    assert.equal(
      (await applyRecords(ctx.db, records, sourceId)).bulkRecords,
      0,
    );
    assert.equal(
      await ctx.db.catalogOutbox.count({ where: { entityId: { in: ids } } }),
      3,
    );
    const first = mappings.find((row) => row.externalId === keys[0])!;
    await ctx.db.author.update({
      where: { id: first.authorId! },
      data: { revision: 2, displayName: 'Manual author' },
    });
    const revisions = records.map((row) => ({
      ...row,
      revision: 2,
      payloadHash: 'new-hash',
      payload: { name: 'Provider update' },
    }));
    await applyRecords(ctx.db, revisions, sourceId);
    assert.equal(
      (
        await ctx.db.author.findUniqueOrThrow({
          where: { id: first.authorId! },
        })
      ).displayName,
      'Manual author',
    );
    assert.equal(
      (
        await ctx.db.importRecord.findUniqueOrThrow({
          where: { id: records[0].id },
        })
      ).status,
      'CONFLICT',
    );
    assert.equal(
      await ctx.db.catalogOutbox.count({ where: { entityId: { in: ids } } }),
      5,
    );
    assert.equal(
      await ctx.db.authorAlias.count({ where: { authorId: { in: ids } } }),
      3,
    );
  } finally {
    await fixture.cleanup();
  }
}
