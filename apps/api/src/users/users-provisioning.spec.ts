import { InternalServerErrorException } from '@nestjs/common';
import { UsersService } from './users.service';

const local = {
  id: 'local-1',
  clerkUserId: 'clerk-1',
  primaryEmail: 'ava@example.com',
  displayName: 'Ava Reader',
  avatarUrl: 'https://images.example.com/avatar.png',
  roleMemberships: [],
};
const upsert = jest.fn();
const findUnique = jest.fn();
const getUser = jest.fn();
const service = new UsersService(
  { user: { upsert, findUnique } } as never,
  { getUser } as never,
);
beforeEach(() => {
  jest.resetAllMocks();
  findUnique.mockResolvedValue(null);
  upsert.mockResolvedValue(local);
  getUser.mockResolvedValue({
    fullName: local.displayName,
    hasImage: true,
    imageUrl: local.avatarUrl,
    primaryEmailAddress: { emailAddress: local.primaryEmail },
    emailAddresses: [],
  });
});
it('provisions a first-seen user from Clerk data and returns a normalized payload', async () => {
  expect(await service.getCurrentUser('clerk-1')).toEqual({
    id: local.id,
    clerkUserId: local.clerkUserId,
    email: local.primaryEmail,
    displayName: local.displayName,
    avatarUrl: local.avatarUrl,
    roles: [],
    telegramUrl: null,
  });
  const profile = {
    primaryEmail: local.primaryEmail,
    displayName: local.displayName,
    avatarUrl: local.avatarUrl,
  };
  expect(upsert).toHaveBeenCalledWith({
    where: { clerkUserId: 'clerk-1' },
    include: { roleMemberships: { select: { role: true } } },
    update: profile,
    create: { clerkUserId: 'clerk-1', ...profile },
  });
});
it('falls back to the first email and username and omits generated avatars', async () => {
  getUser.mockResolvedValue({
    fullName: null,
    username: 'reader',
    hasImage: false,
    imageUrl: 'generated.png',
    primaryEmailAddress: null,
    emailAddresses: [{ emailAddress: 'reader@example.com' }],
  });
  await service.getCurrentUser('clerk-1');
  expect(upsert).toHaveBeenCalledWith(
    expect.objectContaining({
      update: {
        primaryEmail: 'reader@example.com',
        displayName: 'reader',
        avatarUrl: null,
      },
    }),
  );
});
it('throws when a first-seen Clerk user has no email', async () => {
  getUser.mockResolvedValue({ emailAddresses: [] });
  await expect(service.getCurrentUser('clerk-1')).rejects.toBeInstanceOf(
    InternalServerErrorException,
  );
  expect(upsert).not.toHaveBeenCalled();
});
