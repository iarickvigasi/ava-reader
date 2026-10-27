import { BookVisibility, type Prisma } from '@prisma/client';

// Membership never grants another user's private file. Unknown owners fail closed.
export function privateBookAccess(userId: string): Prisma.BookWhereInput {
  return {
    OR: [
      { visibility: BookVisibility.PUBLIC },
      { visibility: BookVisibility.PRIVATE, privateOwnerId: userId },
    ],
  };
}

export const PUBLIC_CATALOG_BOOK = {
  visibility: BookVisibility.PUBLIC,
} satisfies Prisma.BookWhereInput;
