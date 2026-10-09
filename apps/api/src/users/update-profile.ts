import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { INTRODUCTION_MINIMUM, updateProfileSchema } from './profile.dto';

export async function updateProfile(
  prisma: PrismaService,
  clerkUserId: string,
  body: unknown,
) {
  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) throw new BadRequestException('Invalid profile.');
  const { displayName, telegramUrl, ...social } = parsed.data;
  await prisma.$transaction(
    async (tx) => {
      const current = await tx.user.findUnique({ where: { clerkUserId } });
      const published =
        social.profilePublished ?? current?.profilePublished ?? false;
      const introduction = social.introduction ?? current?.introduction ?? '';
      const publishing =
        social.profilePublished === true ||
        (published && social.introduction !== undefined);
      if (
        publishing &&
        Array.from(introduction.trim()).length < INTRODUCTION_MINIMUM
      )
        throw new BadRequestException(
          'A published profile requires at least 50 introduction characters.',
        );
      const result = await tx.user.updateMany({
        where: {
          clerkUserId,
          ...(telegramUrl !== undefined
            ? { roleMemberships: { some: { role: UserRole.DEVELOPER } } }
            : {}),
        },
        data: {
          ...social,
          ...(displayName !== undefined
            ? { displayNameOverride: displayName }
            : {}),
          ...(telegramUrl !== undefined ? { telegramUrl } : {}),
        },
      });
      if (!result.count)
        throw new ForbiddenException('Profile update is not permitted.');
    },
    { isolationLevel: 'Serializable' },
  );
}
