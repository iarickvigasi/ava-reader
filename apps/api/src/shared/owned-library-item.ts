import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { UsersService } from '../users/users.service';

// Resolves the caller's user record and asserts the library item belongs to
// them, addressed by id only — every caller is downstream of a payload that
// already carried the id (see docs/specs/7-library/7.5-library-payloads.md
// for which endpoints take a slug instead). Shared by the annotation and
// AI-comment endpoints; helpers below it take the resolved ids.
export async function requireOwnedLibraryItem(input: {
  clerkUserId: string;
  libraryItemId: string;
  prisma: PrismaService;
  users: UsersService;
}): Promise<{ userId: string; libraryItemId: string }> {
  const user = await input.users.getCurrentUserRecord(input.clerkUserId);
  const libraryItem = await input.prisma.libraryItem.findFirst({
    where: { id: input.libraryItemId, userId: user.id },
    select: { id: true },
  });
  if (!libraryItem) {
    throw new NotFoundException('Library item not found.');
  }
  return { userId: user.id, libraryItemId: libraryItem.id };
}
