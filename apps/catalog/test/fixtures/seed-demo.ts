import type { CatalogDatabase } from '../../src/database/catalog-database';
import { demo } from './demo-data';
import { demoBooks } from './demo-books';

export async function seedDemo(db: CatalogDatabase) {
  await db.$connect();
  await db.$transaction(
    async (tx) => {
      await tx.source.upsert({
        where: { id: demo.sourceId },
        update: {},
        create: {
          id: demo.sourceId,
          key: 'ava-demo',
          name: 'AVA fictional demo fixtures',
        },
      });
      await tx.author.upsert({
        where: { id: demo.authorId },
        update: {},
        create: {
          id: demo.authorId,
          displayName: 'Alex Example',
          aliases: { create: { name: 'Алекс Пример' } },
          texts: {
            create: {
              locale: 'en',
              biography: 'Fictional author used for local testing.',
            },
          },
        },
      });
      for (const book of demoBooks) {
        await tx.work.upsert({
          where: { id: book.workId },
          update: {},
          create: {
            id: book.workId,
            originalTitle: book.title,
            originalLanguage: book.language,
            texts: {
              create: {
                locale: book.language,
                title: book.title,
                description:
                  'Fictional catalog fixture; no readable file is provided.',
              },
            },
            credits: { create: { authorId: demo.authorId } },
            editions: {
              create: {
                id: book.editionId,
                title: book.title,
                language: book.language,
                format: 'EBOOK',
                publisher: 'AVA Demo',
                publishedYear: 2026,
              },
            },
          },
        });
        await tx.sourceMapping.upsert({
          where: {
            sourceId_entityKind_externalId: {
              sourceId: demo.sourceId,
              entityKind: 'WORK',
              externalId: book.workId,
            },
          },
          update: {},
          create: {
            sourceId: demo.sourceId,
            entityKind: 'WORK',
            externalId: book.workId,
            workId: book.workId,
          },
        });
      }
    },
    { maxWait: 10000, timeout: 15000 },
  );
}
