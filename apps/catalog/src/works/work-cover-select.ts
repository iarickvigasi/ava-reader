import type { Prisma } from '#catalog-client';

export const WORK_COVER_SELECT = {
  coverImageUrl: true,
  editions: {
    where: { coverImageUrl: { not: null } },
    orderBy: [{ publishedYear: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }],
    take: 1,
    select: { coverImageUrl: true },
  },
} satisfies Prisma.WorkSelect;
