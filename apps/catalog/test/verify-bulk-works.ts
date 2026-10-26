import assert from 'node:assert/strict';
import { bulkLinkedFixture } from './bulk-linked-fixture';
import type { ImportFixture } from './importer-fixtures';

export async function verifyBulkWorks(ctx: ImportFixture) {
  const f = bulkLinkedFixture(ctx);
  try {
    const author = f.key('AUTHOR'),
      missing = f.key('AUTHOR');
    await (
      await f.stage('bulk-work-author', [
        [author, 'author', { name: 'Linked author' }],
      ])
    ).apply();
    const first = f.key('WORK'),
      second = f.key('WORK');
    const batch = await f.stage('bulk-works', [
      [
        first,
        'work',
        {
          title: 'First work',
          original_language: { key: '/languages/eng' },
          description: { value: 'Description' },
          subjects: ['Fiction'],
          covers: [123],
          authors: [{ author: { key: missing } }, { author: { key: author } }],
        },
      ],
      [
        second,
        'work',
        { title: 'Second work', authors: [{ author: { key: author } }] },
      ],
    ]);
    assert.equal((await batch.apply()).bulkRecords, 2);
    const mapping = await ctx.mapped(first);
    const work = await ctx.db.work.findUniqueOrThrow({
      where: { id: mapping.workId! },
      include: { texts: true, credits: true },
    });
    assert.equal(work.originalLanguage, 'en');
    assert.equal(work.coverId, 123);
    assert.equal(work.texts[0].description, 'Description');
    assert.deepEqual(work.subjects, ['Fiction']);
    assert.equal(work.credits.length, 1);
    assert.equal(work.credits[0].position, 0);
    assert.equal(
      (
        await ctx.db.importRecord.findUniqueOrThrow({
          where: { id: batch.records[0].id },
        })
      ).status,
      'UNRESOLVED',
    );
    await (
      await f.stage('bulk-work-missing-author', [
        [missing, 'author', { name: 'Late author' }],
      ])
    ).apply();
    await batch.apply();
    assert.equal(
      await ctx.db.workCredit.count({ where: { workId: mapping.workId! } }),
      2,
    );
    assert.equal((await ctx.mapped(first)).workId, mapping.workId);
    const mixed = await f.stage('bulk-work-mixed', [
      [first, 'work', { title: 'Updated work' }, 2],
      [f.key('WORK'), 'work', { title: 'New mixed work' }],
    ]);
    assert.equal((await mixed.apply()).bulkRecords, 1);
    assert.equal(
      (await ctx.db.work.findUniqueOrThrow({ where: { id: mapping.workId! } }))
        .coverId,
      123,
    );
  } finally {
    await f.cleanup();
  }
}
