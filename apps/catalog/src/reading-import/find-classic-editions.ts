import type { CatalogDatabase } from '../database/catalog-database';
import { SOURCE_KEY } from '../importer/types';
import type { ClassicSeed } from './classic-seeds/types';
import { classicTitleVariants } from './classic-title-variants';

export async function findClassicEditions(
  db: CatalogDatabase,
  classic: ClassicSeed,
) {
  const titles = classicTitleVariants(classic);
  const names = [classic.author, ...classic.authorAliases];
  return db.edition.findMany({
    where: {
      language: classic.language,
      OR: [
        { title: { in: titles, mode: 'insensitive' } },
        { work: { originalTitle: { in: titles, mode: 'insensitive' } } },
        {
          work: {
            texts: {
              some: {
                locale: classic.language,
                title: { in: titles, mode: 'insensitive' },
              },
            },
          },
        },
      ],
      work: {
        deletedAt: null,
        metadataIncomplete: false,
        credits: {
          some: {
            role: 'AUTHOR',
            author: {
              OR: names.flatMap((name) => [
                {
                  displayName: { contains: name, mode: 'insensitive' as const },
                },
                {
                  aliases: {
                    some: {
                      name: { contains: name, mode: 'insensitive' as const },
                    },
                  },
                },
              ]),
            },
          },
        },
      },
    },
    include: {
      work: {
        include: {
          credits: {
            where: { role: 'AUTHOR' },
            orderBy: { position: 'asc' },
            include: { author: true },
          },
        },
      },
      sourceMappings: { where: { source: { key: SOURCE_KEY } } },
    },
    orderBy: [{ publishedYear: 'asc' }, { id: 'asc' }],
    take: 100,
  });
}
