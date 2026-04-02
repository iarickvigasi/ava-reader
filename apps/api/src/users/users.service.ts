import type { User as ClerkUser } from '@clerk/backend';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ClerkAuthService } from '../auth/clerk-auth.service';

export type CurrentUserPayload = {
  id: string;
  clerkUserId: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
};

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clerkAuthService: ClerkAuthService,
  ) {}

  async getCurrentUser(clerkUserId: string): Promise<CurrentUserPayload> {
    const clerkUser = await this.clerkAuthService.getUser(clerkUserId);
    const primaryEmail = this.getPrimaryEmail(clerkUser);

    if (!primaryEmail) {
      throw new InternalServerErrorException(
        'The authenticated Clerk user does not have a primary email address.',
      );
    }

    const displayName = clerkUser.fullName ?? clerkUser.username ?? null;
    const avatarUrl = clerkUser.hasImage ? clerkUser.imageUrl : null;

    const user = await this.prisma.user.upsert({
      where: { clerkUserId },
      update: {
        primaryEmail,
        displayName,
        avatarUrl,
      },
      create: {
        clerkUserId,
        primaryEmail,
        displayName,
        avatarUrl,
      },
    });

    return {
      id: user.id,
      clerkUserId: user.clerkUserId,
      email: user.primaryEmail,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
    };
  }

  private getPrimaryEmail(clerkUser: ClerkUser) {
    return (
      clerkUser.primaryEmailAddress?.emailAddress ??
      clerkUser.emailAddresses[0]?.emailAddress ??
      null
    );
  }
}
