import { BookVisibility, type Prisma } from '@prisma/client';
import { publicReadingAccess } from './public-reading-access';

// Membership never grants another user's private file. Unknown owners fail closed.
export function privateBookAccess(userId: string): Prisma.BookWhereInput {
  return {
    OR: [
      publicReadingAccess(userId),
      { visibility: BookVisibility.PRIVATE, privateOwnerId: userId },
    ],
  };
}

export const PUBLIC_CATALOG_BOOK = {
  visibility: BookVisibility.PUBLIC,
} satisfies Prisma.BookWhereInput;
