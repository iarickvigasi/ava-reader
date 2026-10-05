import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { updateProfile } from './update-profile';

const updateMany = jest.fn();
const prisma = { user: { updateMany } };
beforeEach(() => {
  updateMany.mockReset().mockResolvedValue({ count: 1 });
});

it('saves an AVA name without overwriting the Clerk identity', async () => {
  await updateProfile(prisma as never, 'clerk-1', { displayName: ' Ada ' });
  expect(updateMany).toHaveBeenCalledWith({
    where: { clerkUserId: 'clerk-1' },
    data: { displayNameOverride: 'Ada' },
  });
});
it('atomically restricts Telegram changes to developers, including removal', async () => {
  for (const telegramUrl of ['https://t.me/ava_dev/', null]) {
    await updateProfile(prisma as never, 'clerk-1', {
      displayName: 'Ada',
      telegramUrl,
    });
    expect(updateMany).toHaveBeenLastCalledWith({
      where: { clerkUserId: 'clerk-1', role: 'DEVELOPER' },
      data: {
        displayNameOverride: 'Ada',
        telegramUrl: telegramUrl?.replace(/\/$/, '') ?? null,
      },
    });
  }
  updateMany.mockResolvedValue({ count: 0 });
  await expect(
    updateProfile(prisma as never, 'clerk-1', {
      displayName: 'Ada',
      telegramUrl: null,
    }),
  ).rejects.toBeInstanceOf(ForbiddenException);
});
it.each([
  'https://evil.test/ava_dev',
  'javascript:alert(1)',
  'http://t.me/ava_dev',
  'https://t.me.evil.test/ava_dev',
  'https://t.me/+invite',
  'https://t.me/ava_dev?start=x',
  'https://t.me/ava_dev/post',
  'https://t.me/ava_dev#foo',
  'https://t.me/@ava_dev',
])('rejects unsafe or non-profile URL %s', async (telegramUrl) => {
  await expect(
    updateProfile(prisma as never, 'clerk-1', {
      displayName: 'Ada',
      telegramUrl,
    }),
  ).rejects.toBeInstanceOf(BadRequestException);
  expect(updateMany).not.toHaveBeenCalled();
});
it.each([
  { displayName: ' ' },
  { displayName: 'A'.repeat(101) },
  { displayName: 'Ada', role: 'ADMIN' },
  { displayName: 'Ada', clerkUserId: 'other' },
])('rejects invalid names and protected fields', async (body) => {
  await expect(
    updateProfile(prisma as never, 'clerk-1', body),
  ).rejects.toBeInstanceOf(BadRequestException);
  expect(updateMany).not.toHaveBeenCalled();
});
