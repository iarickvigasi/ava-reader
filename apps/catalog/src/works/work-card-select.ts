import type { Prisma } from '#catalog-client';

export const WORK_CARD_SELECT = {
  coverImageUrl: true,
  categories: true,
  editions: {
    where: { coverImageUrl: { not: null } },
    orderBy: [{ publishedYear: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }],
    take: 1,
    select: { coverImageUrl: true },
  },
  id: true,
  originalTitle: true,
  originalLanguage: true,
  revision: true,
  texts: { select: { locale: true, title: true } },
  credits: {
    orderBy: [{ position: 'asc' }, { authorId: 'asc' }],
    include: { author: { select: { id: true, displayName: true } } },
  },
} satisfies Prisma.WorkSelect;
