import { InternalServerErrorException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { ClerkAuthService } from '../auth/clerk-auth.service';

export async function syncClerkProfile(
  prisma: PrismaService,
  auth: ClerkAuthService,
  id: string,
) {
  const user = await auth.getUser(id);
  const primaryEmail =
    user.primaryEmailAddress?.emailAddress ??
    user.emailAddresses[0]?.emailAddress;
  if (!primaryEmail)
    throw new InternalServerErrorException(
      'The authenticated Clerk user does not have a primary email address.',
    );
  const profile = {
    primaryEmail,
    displayName: user.fullName ?? user.username ?? null,
    avatarUrl: user.hasImage ? user.imageUrl : null,
  };
  return prisma.user.upsert({
    where: { clerkUserId: id },
    include: { roleMemberships: { select: { role: true } } },
    update: profile,
    create: { clerkUserId: id, ...profile },
  });
}
