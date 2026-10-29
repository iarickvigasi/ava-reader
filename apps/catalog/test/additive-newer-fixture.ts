import { dumpLine, type ImportFixture } from './importer-fixtures';
export async function additiveNewerFixture(ctx: ImportFixture) {
  return ctx.file('newer-additions', [
    dumpLine(
      ctx.author,
      'author',
      {
        name: 'Provider change',
        alternate_names: ['Old alias', 'New alias'],
        bio: 'Changed bio',
        texts: [{ locale: 'uk', biography: 'Біографія' }],
      },
      2,
    ),
    dumpLine(
      ctx.work,
      'work',
      {
        title: 'Provider change',
        original_language: 'en',
        subjects: ['Fiction', 'Poetry'],
        description: 'Changed description',
        texts: [
          { locale: 'uk', title: 'Українська назва', description: 'Опис' },
        ],
        authors: [{ author: { key: ctx.author } }],
      },
      2,
    ),
    dumpLine(
      ctx.edition,
      'edition',
      {
        title: 'Changed edition',
        works: [{ key: ctx.work }],
        publishers: ['New publisher'],
        isbn_13: ['9780061120084'],
      },
      2,
    ),
  ]);
}
