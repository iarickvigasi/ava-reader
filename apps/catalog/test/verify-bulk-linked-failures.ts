import assert from 'node:assert/strict';
import { bulkLinkedFixture } from './bulk-linked-fixture';
import type { ImportFixture } from './importer-fixtures';

export async function verifyBulkLinkedFailures(ctx: ImportFixture) {
  const f = bulkLinkedFixture(ctx);
  try {
    const work = f.key('WORK');
    const works = await f.stage('invalid-bulk-works', [
      [work, 'work', { title: 'Valid work' }],
      [f.key('WORK'), 'work', { title: 'Invalid subjects', subjects: 'bad' }],
    ]);
    assert.equal((await works.apply()).fallbackRecords, 2);
    assert.ok((await ctx.mapped(work)).workId);
    const invalidWork = await ctx.db.importRecord.findUniqueOrThrow({
      where: { id: works.records[1].id },
    });
    assert.equal(invalidWork.status, 'INVALID');
    assert.ok(invalidWork.payload);
    const editions = await f.stage('invalid-bulk-editions', [
      [
        f.key('EDITION'),
        'edition',
        {
          title: 'Valid edition',
          works: [{ key: work }],
          isbn_13: ['9780306406157'],
        },
      ],
      [
        f.key('EDITION'),
        'edition',
        { title: 'Invalid ISBN array', works: [{ key: work }], isbn_10: 'bad' },
      ],
    ]);
    const before = await ctx.db.edition.count();
    assert.equal((await editions.apply()).fallbackRecords, 2);
    assert.equal(await ctx.db.edition.count(), before + 1);
    const invalid = await ctx.db.importRecord.findUniqueOrThrow({
      where: { id: editions.records[1].id },
    });
    assert.equal(invalid.status, 'INVALID');
    assert.ok(invalid.payload);
    assert.match(invalid.diagnostic!, /string array/);
  } finally {
    await f.cleanup();
  }
}
