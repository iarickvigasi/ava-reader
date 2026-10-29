import { runImport } from '../src/importer/run-import';
import { dumpLine, type ImportFixture } from './importer-fixtures';
export async function additiveInitialFixture(ctx: ImportFixture) {
  await runImport(
    ctx.db,
    await ctx.file('initial', [
      dumpLine(ctx.author, 'author', {
        name: 'Original',
        alternate_names: ['Old alias'],
        bio: 'Original bio',
      }),
      dumpLine(ctx.work, 'work', {
        title: 'Original work',
        original_language: 'en',
        subjects: ['Fiction'],
        description: 'Original description',
        authors: [{ author: { key: ctx.author } }],
      }),
      dumpLine(ctx.edition, 'edition', {
        title: 'Original edition',
        works: [{ key: ctx.work }],
        isbn_10: ['0140328726'],
      }),
    ]),
  );
}
