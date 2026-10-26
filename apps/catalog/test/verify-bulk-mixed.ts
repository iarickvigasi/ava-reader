import assert from 'node:assert/strict';
import { bulkLinkedFixture } from './bulk-linked-fixture';
import type { ImportFixture } from './importer-fixtures';

export async function verifyBulkMixed(ctx: ImportFixture) {
  const f = bulkLinkedFixture(ctx);
  try {
    const existing = f.key('AUTHOR'),
      fresh = f.key('AUTHOR');
    await (
      await f.stage('mixed-existing', [
        [existing, 'author', { name: 'Existing' }],
      ])
    ).apply();
    const original = await ctx.mapped(existing);
    const mixed = await f.stage('mixed-new', [
      [existing, 'author', { name: 'Updated' }, 2],
      [fresh, 'author', { name: 'New' }],
    ]);
    const metrics = await mixed.apply();
    assert.equal(metrics.bulkRecords, 1);
    assert.equal(metrics.fallbackRecords, 0);
    assert.equal((await ctx.mapped(existing)).authorId, original.authorId);
    assert.equal((await ctx.mapped(existing)).sourceRevision, '2');
    const another = f.key('AUTHOR');
    await ctx.db.author.update({
      where: { id: original.authorId! },
      data: { revision: 3, displayName: 'Manual' },
    });
    const conflict = await f.stage('mixed-conflict', [
      [another, 'author', { name: 'New beside conflict' }],
      [existing, 'author', { name: 'Cannot overwrite' }, 3],
    ]);
    await conflict.apply();
    assert.ok((await ctx.mapped(another)).authorId);
    assert.equal(
      (
        await ctx.db.author.findUniqueOrThrow({
          where: { id: original.authorId! },
        })
      ).displayName,
      'Manual',
    );
    assert.equal(
      (
        await ctx.db.importRecord.findUniqueOrThrow({
          where: { id: conflict.records[1].id },
        })
      ).status,
      'CONFLICT',
    );
  } finally {
    await f.cleanup();
  }
}
