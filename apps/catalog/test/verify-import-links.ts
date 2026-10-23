import assert from 'node:assert/strict';
import { runImport } from '../src/importer/run-import';
import { dumpLine, type ImportFixture } from './importer-fixtures';

export async function verifyImportLinks(ctx: ImportFixture) {
  const edition = await ctx.file(
    'edition',
    [
      dumpLine(ctx.edition, 'edition', {
        title: 'Fixture edition',
        works: [{ key: ctx.work }],
        authors: [{ key: ctx.author }],
        isbn_10: ['0140328726', 'bad'],
        languages: [{ key: '/languages/eng' }],
      }),
    ],
    true,
  );
  assert.equal((await runImport(ctx.db, edition)).counts.UNRESOLVED, 1);
  const work = await ctx.file('work', [
    dumpLine(ctx.work, 'work', {
      title: 'Fixture work',
      authors: [{ author: { key: ctx.author } }],
      description: { value: 'Source description' },
    }),
  ]);
  assert.equal((await runImport(ctx.db, work)).counts.UNRESOLVED, 1);
  const author = await ctx.file('author', [
    dumpLine(ctx.author, 'author', {
      name: 'Fixture writer',
      alternate_names: ['Писатель'],
      bio: { value: 'A fixture biography' },
    }),
  ]);
  assert.equal((await runImport(ctx.db, author)).counts.APPLIED, 1);
  const repacked = await ctx.file(
    'repacked-author',
    [
      dumpLine(ctx.author, 'author', {
        name: 'Fixture writer',
        alternate_names: ['Писатель'],
        bio: { value: 'A fixture biography' },
      }),
    ],
    true,
  );
  assert.equal((await runImport(ctx.db, repacked)).counts.SKIPPED, 1);
  const editionMap = await ctx.mapped(ctx.edition);
  const workMap = await ctx.mapped(ctx.work);
  const authorMap = await ctx.mapped(ctx.author);
  const stored = await ctx.db.edition.findUniqueOrThrow({
    where: { id: editionMap.editionId! },
    include: { identifiers: { include: { identifier: true } } },
  });
  assert.equal(stored.workId, workMap.workId);
  assert.equal(stored.language, 'en');
  assert.equal(stored.identifiers.length, 1);
  assert.equal(
    stored.identifiers[0].identifier.normalizedValue,
    '9780140328721',
  );
  assert.equal(
    await ctx.db.workCredit.count({
      where: {
        workId: workMap.workId!,
        authorId: authorMap.authorId!,
      },
    }),
    1,
  );
  const ids = [editionMap.editionId!, workMap.workId!, authorMap.authorId!];
  const outboxBefore = await ctx.db.catalogOutbox.count({
    where: { entityId: { in: ids } },
  });
  await runImport(ctx.db, author);
  await runImport(ctx.db, work);
  await runImport(ctx.db, edition);
  assert.equal(
    await ctx.db.catalogOutbox.count({ where: { entityId: { in: ids } } }),
    outboxBefore,
  );
  assert.equal((await ctx.mapped(ctx.work)).workId, workMap.workId);
}
