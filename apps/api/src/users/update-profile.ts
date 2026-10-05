import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { updateProfileSchema } from './profile.dto';

export async function updateProfile(
  prisma: PrismaService,
  clerkUserId: string,
  body: unknown,
) {
  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) throw new BadRequestException('Invalid profile.');
  const { displayName, telegramUrl } = parsed.data;
  const result = await prisma.user.updateMany({
    where: {
      clerkUserId,
      ...(telegramUrl !== undefined ? { role: UserRole.DEVELOPER } : {}),
    },
    data: {
      displayNameOverride: displayName,
      ...(telegramUrl !== undefined ? { telegramUrl } : {}),
    },
  });
  if (!result.count)
    throw new ForbiddenException(
      'Only developers may edit a Telegram contact.',
    );
}
