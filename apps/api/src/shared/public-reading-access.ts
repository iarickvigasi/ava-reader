import type { Prisma } from '@prisma/client';

export function publicReadingAccess(userId: string): Prisma.BookWhereInput {
  return {
    visibility: 'PUBLIC',
    OR: [
      { catalogEntry: { is: null } },
      { catalogEntry: { importKey: null } },
      { catalogEntry: { importPublishedAt: { not: null } } },
      { catalogEntry: { status: 'PUBLISHED' } },
      {
        libraryItems: {
          some: {
            userId,
            user: { roleMemberships: { some: { role: 'ADMIN' } } },
          },
        },
      },
    ],
  };
}
