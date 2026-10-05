import { UserRole } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { telegramUrlSchema } from '../users/profile.dto';

export async function loadDevelopers(prisma: PrismaService) {
  const users = await prisma.user.findMany({
    where: { role: UserRole.DEVELOPER, telegramUrl: { not: null } },
    select: {
      id: true,
      displayName: true,
      displayNameOverride: true,
      avatarUrl: true,
      telegramUrl: true,
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  return users.flatMap((user) => {
    const displayName = (user.displayNameOverride ?? user.displayName)?.trim();
    const link = telegramUrlSchema.safeParse(user.telegramUrl);
    return displayName && link.success
      ? [
          {
            id: user.id,
            displayName,
            avatarUrl: user.avatarUrl,
            telegramUrl: link.data,
          },
        ]
      : [];
  });
}
