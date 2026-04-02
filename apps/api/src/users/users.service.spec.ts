import type { User as ClerkUser } from '@clerk/backend';
import { InternalServerErrorException } from '@nestjs/common';
import { UsersService } from './users.service';

function createClerkUser(overrides: Partial<ClerkUser>) {
  return overrides as unknown as ClerkUser;
}

describe('UsersService', () => {
  const upsert = jest.fn();
  const getUser = jest.fn();
  const prisma = {
    user: {
      upsert,
    },
  };
  const clerkAuthService = {
    getUser,
  };
  let usersService: UsersService;

  beforeEach(() => {
    upsert.mockReset();
    getUser.mockReset();
    usersService = new UsersService(prisma as never, clerkAuthService as never);
  });

  it('upserts the local user from Clerk data and returns a normalized payload', async () => {
    getUser.mockResolvedValue(
      createClerkUser({
        id: 'user_clerk_123',
        fullName: 'Ava Reader',
        username: null,
        hasImage: true,
        imageUrl: 'https://images.example.com/avatar.png',
        primaryEmailAddress: { emailAddress: 'ava@example.com' } as never,
        emailAddresses: [{ emailAddress: 'ava@example.com' }] as never,
      }),
    );

    upsert.mockResolvedValue({
      id: 'local_user_123',
      clerkUserId: 'user_clerk_123',
      primaryEmail: 'ava@example.com',
      displayName: 'Ava Reader',
      avatarUrl: 'https://images.example.com/avatar.png',
      role: 'USER',
    });

    await expect(
      usersService.getCurrentUser('user_clerk_123'),
    ).resolves.toEqual({
      id: 'local_user_123',
      clerkUserId: 'user_clerk_123',
      email: 'ava@example.com',
      displayName: 'Ava Reader',
      avatarUrl: 'https://images.example.com/avatar.png',
      role: 'USER',
    });

    expect(upsert).toHaveBeenCalledWith({
      where: { clerkUserId: 'user_clerk_123' },
      update: {
        primaryEmail: 'ava@example.com',
        displayName: 'Ava Reader',
        avatarUrl: 'https://images.example.com/avatar.png',
      },
      create: {
        clerkUserId: 'user_clerk_123',
        primaryEmail: 'ava@example.com',
        displayName: 'Ava Reader',
        avatarUrl: 'https://images.example.com/avatar.png',
      },
    });
  });

  it('falls back to the first email address when Clerk has no primary email getter', async () => {
    getUser.mockResolvedValue(
      createClerkUser({
        id: 'user_clerk_456',
        fullName: null,
        username: 'reader',
        hasImage: false,
        imageUrl: 'https://images.example.com/generated.png',
        primaryEmailAddress: null,
        emailAddresses: [{ emailAddress: 'reader@example.com' }] as never,
      }),
    );

    upsert.mockResolvedValue({
      id: 'local_user_456',
      clerkUserId: 'user_clerk_456',
      primaryEmail: 'reader@example.com',
      displayName: 'reader',
      avatarUrl: null,
      role: 'USER',
    });

    await expect(
      usersService.getCurrentUser('user_clerk_456'),
    ).resolves.toEqual({
      id: 'local_user_456',
      clerkUserId: 'user_clerk_456',
      email: 'reader@example.com',
      displayName: 'reader',
      avatarUrl: null,
      role: 'USER',
    });
  });

  it('throws when the Clerk user has no email address to persist locally', async () => {
    getUser.mockResolvedValue(
      createClerkUser({
        id: 'user_clerk_789',
        fullName: null,
        username: null,
        hasImage: false,
        imageUrl: '',
        primaryEmailAddress: null,
        emailAddresses: [],
      }),
    );

    await expect(
      usersService.getCurrentUser('user_clerk_789'),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
    expect(upsert).not.toHaveBeenCalled();
  });
});
