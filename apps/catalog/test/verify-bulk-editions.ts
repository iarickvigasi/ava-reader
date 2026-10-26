import assert from 'node:assert/strict';
import { bulkLinkedFixture } from './bulk-linked-fixture';
import type { ImportFixture } from './importer-fixtures';

export async function verifyBulkEditions(ctx: ImportFixture) {
  const f = bulkLinkedFixture(ctx);
  try {
    const author = f.key('AUTHOR'),
      work = f.key('WORK');
    await f.apply('bulk-edition-author', [
      [author, 'author', { name: 'Edition author' }],
    ]);
    await f.apply('bulk-edition-work', [
      [work, 'work', { title: 'Edition work' }],
    ]);
    const first = f.key('EDITION'),
      second = f.key('EDITION'),
      missingAuthor = f.key('AUTHOR');
    const batch = await f.stage('bulk-editions', [
      [
        first,
        'edition',
        {
          title: 'First edition',
          works: [{ key: work }],
          authors: [{ key: author }, { key: missingAuthor }],
          isbn_10: ['0-306-40615-2'],
          isbn_13: ['9780306406157', 'invalid'],
          languages: [{ key: '/languages/eng' }],
          publishers: ['Publisher'],
          publish_date: 'May 2001',
          physical_format: 'Hardcover',
          covers: [234],
        },
      ],
      [
        second,
        'edition',
        {
          title: 'Second edition',
          works: [{ key: work }],
          isbn_13: ['9780306406157'],
        },
      ],
    ]);
    assert.equal((await batch.apply()).bulkRecords, 2);
    const mapping = await ctx.mapped(first);
    const edition = await ctx.db.edition.findUniqueOrThrow({
      where: { id: mapping.editionId! },
      include: {
        identifiers: { include: { identifier: true } },
        credits: true,
      },
    });
    assert.equal(edition.workId, (await ctx.mapped(work)).workId);
    assert.equal(edition.language, 'en');
    assert.equal(edition.publisher, 'Publisher');
    assert.equal(edition.publishedYear, 2001);
    assert.equal(edition.format, 'HARDCOVER');
    assert.equal(edition.coverId, 234);
    assert.equal(edition.credits.length, 1);
    assert.equal(edition.identifiers.length, 1);
    assert.equal(
      edition.identifiers[0].identifier.normalizedValue,
      '9780306406157',
    );
    assert.equal((await f.outcome(batch.records[0].id)).status, 'UNRESOLVED');
    await (
      await f.stage('bulk-edition-missing-author', [
        [missingAuthor, 'author', { name: 'Late edition author' }],
      ])
    ).apply();
    await batch.apply();
    assert.equal(
      await ctx.db.editionCredit.count({
        where: { editionId: mapping.editionId! },
      }),
      2,
    );
    assert.equal((await ctx.mapped(first)).editionId, mapping.editionId);
    const ids = [mapping.editionId!, (await ctx.mapped(second)).editionId!];
    assert.equal(
      await ctx.db.editionIdentifier.count({
        where: { editionId: { in: ids } },
      }),
      2,
    );
  } finally {
    await f.cleanup();
  }
}
