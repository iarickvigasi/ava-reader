import type { User as ClerkUser } from '@clerk/backend';
import { InternalServerErrorException } from '@nestjs/common';
import { UsersService } from './users.service';

function createClerkUser(overrides: Partial<ClerkUser>) {
  return overrides as unknown as ClerkUser;
}

function localUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'local_user_123',
    clerkUserId: 'user_clerk_123',
    primaryEmail: 'ava@example.com',
    displayName: 'Ava Reader',
    avatarUrl: 'https://images.example.com/avatar.png',
    role: 'USER',
    updatedAt: new Date(),
    ...overrides,
  };
}

// Lets fire-and-forget background work settle before assertions.
const flushMicrotasks = () => new Promise((resolve) => setImmediate(resolve));

describe('UsersService', () => {
  const upsert = jest.fn();
  const findUnique = jest.fn();
  const getUser = jest.fn();
  const prisma = {
    user: {
      upsert,
      findUnique,
    },
  };
  const clerkAuthService = {
    getUser,
  };
  let usersService: UsersService;

  beforeEach(() => {
    upsert.mockReset();
    findUnique.mockReset();
    getUser.mockReset();
    // Default: user not provisioned yet → the "first-seen" Clerk path.
    findUnique.mockResolvedValue(null);
    usersService = new UsersService(prisma as never, clerkAuthService as never);
  });

  it('provisions a first-seen user from Clerk data and returns a normalized payload', async () => {
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
    upsert.mockResolvedValue(localUser());

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
    upsert.mockResolvedValue(
      localUser({
        id: 'local_user_456',
        clerkUserId: 'user_clerk_456',
        primaryEmail: 'reader@example.com',
        displayName: 'reader',
        avatarUrl: null,
      }),
    );

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

  it('throws when a first-seen Clerk user has no email to persist locally', async () => {
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

  it('returns an already-provisioned user from the DB without calling Clerk (offline-safe)', async () => {
    findUnique.mockResolvedValue(localUser({ updatedAt: new Date() }));

    const user = await usersService.getCurrentUserRecord('user_clerk_123');
    await flushMicrotasks();

    expect(user).toMatchObject({ id: 'local_user_123' });
    expect(getUser).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it('refreshes a stale profile in the background while still returning the cached record', async () => {
    findUnique.mockResolvedValue(
      localUser({ updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000) }),
    );
    getUser.mockResolvedValue(
      createClerkUser({
        id: 'user_clerk_123',
        fullName: 'Ava Reader',
        username: null,
        hasImage: false,
        imageUrl: '',
        primaryEmailAddress: { emailAddress: 'ava@example.com' } as never,
        emailAddresses: [{ emailAddress: 'ava@example.com' }] as never,
      }),
    );
    upsert.mockResolvedValue(localUser());

    const user = await usersService.getCurrentUserRecord('user_clerk_123');
    expect(user).toMatchObject({ id: 'local_user_123' });
    await flushMicrotasks();

    expect(getUser).toHaveBeenCalledWith('user_clerk_123');
    expect(upsert).toHaveBeenCalled();
  });

  it('swallows a failed background refresh (offline) and still returns the cached record', async () => {
    findUnique.mockResolvedValue(
      localUser({ updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000) }),
    );
    getUser.mockRejectedValue(new Error('offline'));

    const user = await usersService.getCurrentUserRecord('user_clerk_123');
    await flushMicrotasks();

    expect(user).toMatchObject({ id: 'local_user_123' });
  });
});
