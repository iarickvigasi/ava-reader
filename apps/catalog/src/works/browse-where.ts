import { READY_READING_ASSET } from './ready-reading-assets';
import { Prisma } from '#catalog-client';
import { normalizeIsbn } from '../importer/normalize-isbn';
import type { BrowseQuery } from './browse-query';

export function browseWhere(input: BrowseQuery): Prisma.WorkWhereInput {
  const AND: Prisma.WorkWhereInput[] = [];
  if (input.cursor) AND.push({ id: { gt: input.cursor } });
  if (input.before) AND.push({ id: { lt: input.before } });
  const edition: Prisma.EditionWhereInput = {};
  if (input.languages.length) edition.language = { in: input.languages };
  if (input.filters.includes('readable'))
    edition.readingAssets = { some: READY_READING_ASSET };
  if (Object.keys(edition).length) AND.push({ editions: { some: edition } });
  const categories = input.filters.filter((v) => v !== 'readable');
  if (categories.length) AND.push({ categories: { hasSome: categories } });
  const isbn = normalizeIsbn(input.query);
  if (isbn) {
    AND.push({
      editions: {
        some: {
          identifiers: {
            some: {
              identifier: { scheme: 'ISBN_13', normalizedValue: isbn },
            },
          },
        },
      },
    });
  } else {
    for (const token of input.query.split(/\s+/).filter(Boolean).slice(0, 12)) {
      const contains = {
        contains: token.replace(/[\\%_]/g, '\\$&'),
        mode: 'insensitive' as const,
      };
      AND.push({
        OR: [
          { originalTitle: contains },
          { texts: { some: { title: contains } } },
          { editions: { some: { title: contains } } },
          {
            credits: {
              some: {
                author: {
                  OR: [
                    { displayName: contains },
                    { aliases: { some: { name: contains } } },
                  ],
                },
              },
            },
          },
        ],
      });
    }
  }
  return { deletedAt: null, AND };
}
