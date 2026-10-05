import { toUserRecord, type UserRecord } from './user-record';
import { syncClerkProfile } from './sync-clerk-profile';
import { UserRole } from '@prisma/client';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ClerkAuthService } from '../auth/clerk-auth.service';

export type CurrentUserPayload = {
  id: string;
  clerkUserId: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  roles: UserRole[];
  telegramUrl: string | null;
};

const USER_PROFILE_REFRESH_INTERVAL_MS = 60 * 60 * 1000;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clerkAuthService: ClerkAuthService,
  ) {}

  async getCurrentUser(clerkUserId: string): Promise<CurrentUserPayload> {
    const user = await this.getCurrentUserRecord(clerkUserId);

    return this.serializeCurrentUser(user);
  }

  async getCurrentUserRecord(clerkUserId: string): Promise<UserRecord> {
    const existing = await this.prisma.user.findUnique({
      where: { clerkUserId },
      include: { roleMemberships: { select: { role: true } } },
    });

    if (!existing) {
      const created = await syncClerkProfile(
        this.prisma,
        this.clerkAuthService,
        clerkUserId,
      );
      return toUserRecord(created);
    }

    if (
      Date.now() - existing.updatedAt.getTime() >=
      USER_PROFILE_REFRESH_INTERVAL_MS
    ) {
      void syncClerkProfile(
        this.prisma,
        this.clerkAuthService,
        clerkUserId,
      ).catch(() => undefined);
    }

    return toUserRecord(existing);
  }

  async assertAdmin(clerkUserId: string) {
    const user = await this.getCurrentUserRecord(clerkUserId);

    if (!user.roles.includes(UserRole.ADMIN)) {
      throw new ForbiddenException('Admin access is required.');
    }

    return user;
  }

  private serializeCurrentUser(user: UserRecord): CurrentUserPayload {
    return {
      id: user.id,
      clerkUserId: user.clerkUserId,
      email: user.primaryEmail,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      roles: user.roles,
      telegramUrl: user.telegramUrl ?? null,
    };
  }
}
