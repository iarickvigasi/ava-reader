import { importConflicts } from '../src/importer/import-conflicts';
import { additiveInitialFixture } from './additive-initial-fixture';
import { additiveNewerFixture } from './additive-newer-fixture';
import assert from 'node:assert/strict';
import { runImport } from '../src/importer/run-import';
import { saveWork } from '../src/editorial/save-work';
import { saveAuthor } from '../src/editorial/save-author';
import { type ImportFixture } from './importer-fixtures';
export async function verifyAdditiveReimport(ctx: ImportFixture) {
  await additiveInitialFixture(ctx);
  const authorId = (await ctx.mapped(ctx.author)).authorId!;
  const workId = (await ctx.mapped(ctx.work)).workId!;
  const editionId = (await ctx.mapped(ctx.edition)).editionId!;
  const author = await ctx.db.author.findUniqueOrThrow({
    where: { id: authorId },
  });
  await saveAuthor(ctx.db, authorId, author.revision, {
    displayName: 'Admin name',
    aliases: [],
    texts: [{ locale: 'und', biography: 'Admin bio' }],
  });
  const work = await ctx.db.work.findUniqueOrThrow({ where: { id: workId } });
  await saveWork(ctx.db, workId, work.revision, {
    originalTitle: 'Admin title',
    originalLanguage: 'en',
    coverImageUrl: null,
    subjects: [],
    categories: [],
    texts: [{ locale: 'en', title: 'Admin title', description: null }],
    credits: [],
  });
  const newer = await additiveNewerFixture(ctx);
  assert.equal((await runImport(ctx.db, newer)).counts.CONFLICT, 3);
  const report = await importConflicts(ctx.db);
  assert.ok(
    report.items.some(
      (row) =>
        row.externalId === ctx.work &&
        row.diagnostic?.includes('originalTitle'),
    ),
  );
  const result = await ctx.db.work.findUniqueOrThrow({
    where: { id: workId },
    include: { texts: true, credits: true },
  });
  assert.equal(result.originalTitle, 'Admin title');
  assert.deepEqual(result.subjects, ['Poetry']);
  assert.equal(
    result.texts.find((row) => row.locale === 'en')!.description,
    null,
  );
  assert.equal(
    result.texts.find((row) => row.locale === 'uk')!.title,
    'Українська назва',
  );
  assert.equal(result.credits.length, 0);
  const enriched = await ctx.db.author.findUniqueOrThrow({
    where: { id: authorId },
    include: { aliases: true, texts: true },
  });
  assert.equal(enriched.displayName, 'Admin name');
  assert.deepEqual(
    enriched.aliases.map((row) => row.name),
    ['New alias'],
  );
  assert.equal(
    enriched.texts.find((row) => row.locale === 'und')!.biography,
    'Admin bio',
  );
  assert.equal(
    enriched.texts.find((row) => row.locale === 'uk')!.biography,
    'Біографія',
  );
  const edition = await ctx.db.edition.findUniqueOrThrow({
    where: { id: editionId },
    include: { identifiers: true },
  });
  assert.equal(edition.publisher, 'New publisher');
  assert.equal(edition.title, 'Original edition');
  assert.equal(edition.identifiers.length, 2);
  const events = await ctx.db.catalogOutbox.count({
    where: { entityId: { in: [authorId, workId, editionId] } },
  });
  await runImport(ctx.db, newer);
  assert.equal(
    await ctx.db.catalogOutbox.count({
      where: { entityId: { in: [authorId, workId, editionId] } },
    }),
    events,
  );
}
