import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { UsersService } from '../users/users.service';

// Resolves the caller's user record and asserts the library item belongs to
// them. Every public method on the service starts here, and every helper
// downstream takes the resolved ids rather than the Clerk id.
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
