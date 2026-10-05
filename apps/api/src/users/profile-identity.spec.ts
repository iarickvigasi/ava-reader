import { ForbiddenException } from '@nestjs/common';
import { UsersService } from './users.service';

it('uses the AVA override instead of the refreshed Clerk name', async () => {
  const user = {
    id: 'u',
    clerkUserId: 'c',
    displayName: 'Clerk name',
    displayNameOverride: 'AVA name',
    primaryEmail: 'a@b.test',
    avatarUrl: null,
    telegramUrl: 'https://t.me/ava_dev',
    roleMemberships: [{ role: 'DEVELOPER' }],
    updatedAt: new Date(),
  };
  const service = new UsersService(
    { user: { findUnique: jest.fn().mockResolvedValue(user) } } as never,
    {} as never,
  );
  expect(await service.getCurrentUser('c')).toMatchObject({
    displayName: 'AVA name',
    telegramUrl: 'https://t.me/ava_dev',
  });
  await expect(service.assertAdmin('c')).rejects.toBeInstanceOf(
    ForbiddenException,
  );
});
