import type { Prisma } from '@prisma/client';

// Every item read/mutation resolves ownership the same way: the user's own,
// not archived, addressed by either the item id or the per-user slug (read
// endpoints accept both — see docs/specs/7-library/7.5-library-payloads.md).
export function ownedLibraryItemWhere(
  userId: string,
  ref: string,
): Prisma.LibraryItemWhereInput {
  return {
    userId,
    isArchived: false,
    OR: [{ id: ref }, { slug: ref }],
  };
}
