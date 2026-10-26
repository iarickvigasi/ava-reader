import assert from 'node:assert/strict';
import { bulkLinkedFixture } from './bulk-linked-fixture';
import type { ImportFixture } from './importer-fixtures';

export async function verifyBulkPlaceholders(ctx: ImportFixture) {
  const f = bulkLinkedFixture(ctx);
  try {
    const work = f.key('WORK'),
      missing = f.key('WORK');
    await (
      await f.stage('placeholder-known-work', [
        [work, 'work', { title: 'Known work' }],
      ])
    ).apply();
    const first = f.key('EDITION'),
      second = f.key('EDITION'),
      third = f.key('EDITION'),
      ambiguous = f.key('EDITION');
    const batch = await f.stage('placeholder-mixed-editions', [
      [first, 'edition', { title: 'Known edition', works: [{ key: work }] }],
      [
        second,
        'edition',
        { title: 'Placeholder title', works: [{ key: missing }] },
      ],
      [
        third,
        'edition',
        { title: 'Shares placeholder', works: [{ key: missing }] },
      ],
    ]);
    const result = await batch.apply();
    assert.equal(result.bulkRecords, 1);
    const placeholder = await ctx.mapped(missing);
    assert.equal(
      (
        await ctx.db.work.findUniqueOrThrow({
          where: { id: placeholder.workId! },
        })
      ).metadataIncomplete,
      true,
    );
    for (const key of [second, third]) {
      assert.equal(
        (
          await ctx.db.edition.findUniqueOrThrow({
            where: { id: (await ctx.mapped(key)).editionId! },
          })
        ).workId,
        placeholder.workId,
      );
    }
    const invalid = await f.stage('ambiguous-edition', [
      [
        ambiguous,
        'edition',
        {
          title: 'Ambiguous edition',
          works: [{ key: work }, { key: missing }],
        },
      ],
    ]);
    await invalid.apply();
    const outcome = await ctx.db.importRecord.findUniqueOrThrow({
      where: { id: invalid.records[0].id },
    });
    assert.equal(outcome.status, 'UNRESOLVED');
    assert.equal(outcome.diagnostic, 'Edition needs exactly one linked work');
    assert.ok(outcome.payload);
    const upgrade = await f.stage('placeholder-upgrade-mixed', [
      [missing, 'work', { title: 'Actual work' }],
      [f.key('WORK'), 'work', { title: 'New work beside upgrade' }],
    ]);
    assert.equal((await upgrade.apply()).bulkRecords, 1);
    assert.equal((await ctx.mapped(missing)).workId, placeholder.workId);
    assert.equal(
      (
        await ctx.db.work.findUniqueOrThrow({
          where: { id: placeholder.workId! },
        })
      ).metadataIncomplete,
      false,
    );
  } finally {
    await f.cleanup();
  }
}
