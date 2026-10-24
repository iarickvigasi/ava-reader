import { createReadingFixtures } from './create-reading-fixtures';
import type { CatalogDatabase } from '../src/database/catalog-database';

export async function createBrowseFixtures(
  db: CatalogDatabase,
  {
    authorId,
    marker,
    workIds,
  }: { authorId: string; marker: string; workIds: string[] },
) {
  await db.author.create({
    data: {
      id: authorId,
      displayName: marker,
      aliases: { create: { name: `Alias-${authorId}` } },
    },
  });
  await db.work.createMany({
    data: workIds.map((id) => ({
      id,
      categories: ['fantasy'],
      originalTitle: marker,
    })),
  });
  await db.workCredit.createMany({
    data: workIds.map((workId) => ({ workId, authorId })),
  });
  await db.workText.create({
    data: {
      workId: workIds[0],
      locale: 'en',
      title: marker,
      description: 'Description',
    },
  });
  await db.edition.create({
    data: {
      workId: workIds[0],
      title: marker,
      coverImageUrl: 'https://books.example.test/covers/1111.jpg',
      publishedYear: 2000,
      language: 'en',
      format: 'PAPERBACK',
      identifiers: {
        create: {
          identifier: {
            connectOrCreate: {
              where: {
                scheme_normalizedValue: {
                  scheme: 'ISBN_13',
                  normalizedValue: '9780306406157',
                },
              },
              create: { scheme: 'ISBN_13', normalizedValue: '9780306406157' },
            },
          },
        },
      },
    },
  });
  await db.edition.create({
    data: {
      workId: workIds[0],
      title: marker,
      coverImageUrl: 'https://books.example.test/covers/2222.jpg',
      publishedYear: 1990,
      language: 'ru',
      format: 'EBOOK',
    },
  });
  await createReadingFixtures(db, workIds[0]);
}
