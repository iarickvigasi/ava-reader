import type { User as ClerkUser } from '@clerk/backend';
import { UserRole, type User as AppUser } from '@prisma/client';
import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ClerkAuthService } from '../auth/clerk-auth.service';

export type CurrentUserPayload = {
  id: string;
  clerkUserId: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: UserRole;
};

// How stale a provisioned user's profile may be before the next read triggers
// an opportunistic (background) refresh from Clerk. Throttles Clerk API calls
// to ~once/user/hour instead of once per request.
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

  // Resolves the local user record. DB-first so authenticated reads work
  // offline: once a user is provisioned, we serve their Postgres row WITHOUT
  // calling Clerk's User API (a network hop that throws when Clerk's cloud is
  // unreachable — wifi off against a still-reachable server). Only a first-seen
  // user requires Clerk (you can't sign up for the first time offline anyway).
  // An already-provisioned user whose profile is stale gets an opportunistic,
  // non-blocking refresh — best-effort, so the request never waits on or fails
  // because of it.
  async getCurrentUserRecord(clerkUserId: string): Promise<AppUser> {
    const existing = await this.prisma.user.findUnique({
      where: { clerkUserId },
    });

    if (!existing) {
      return this.syncProfileFromClerk(clerkUserId);
    }

    if (
      Date.now() - existing.updatedAt.getTime() >=
      USER_PROFILE_REFRESH_INTERVAL_MS
    ) {
      // Fire-and-forget: never block the response, never fail it. Offline this
      // rejects and is swallowed; the cached row stays and we retry next time.
      void this.syncProfileFromClerk(clerkUserId).catch(() => undefined);
    }

    return existing;
  }

  // Fetches the Clerk profile and upserts it into Postgres. Provisions a
  // first-seen user and refreshes a stale one. Requires Clerk to be reachable.
  private async syncProfileFromClerk(clerkUserId: string): Promise<AppUser> {
    const clerkUser = await this.clerkAuthService.getUser(clerkUserId);
    const primaryEmail = this.getPrimaryEmail(clerkUser);

    if (!primaryEmail) {
      throw new InternalServerErrorException(
        'The authenticated Clerk user does not have a primary email address.',
      );
    }

    const displayName = clerkUser.fullName ?? clerkUser.username ?? null;
    const avatarUrl = clerkUser.hasImage ? clerkUser.imageUrl : null;

    return this.prisma.user.upsert({
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
  }

  async assertAdmin(clerkUserId: string) {
    const user = await this.getCurrentUserRecord(clerkUserId);

    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Admin access is required.');
    }

    return user;
  }

  private getPrimaryEmail(clerkUser: ClerkUser) {
    return (
      clerkUser.primaryEmailAddress?.emailAddress ??
      clerkUser.emailAddresses[0]?.emailAddress ??
      null
    );
  }

  private serializeCurrentUser(user: AppUser): CurrentUserPayload {
    return {
      id: user.id,
      clerkUserId: user.clerkUserId,
      email: user.primaryEmail,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      role: user.role,
    };
  }
}
