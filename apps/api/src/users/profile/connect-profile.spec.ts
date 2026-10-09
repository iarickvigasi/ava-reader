import { BadRequestException } from '@nestjs/common';
import { updateProfile } from './update-profile';

const current = {
  introduction:
    'I enjoy thoughtful fiction and discussing books with other readers.',
  profilePublished: false,
};
const findUnique = jest.fn();
const updateMany = jest.fn();
const tx = { user: { findUnique, updateMany } };
const prisma = {
  $transaction: (run: (value: typeof tx) => unknown) => run(tx),
};
beforeEach(() => {
  findUnique.mockReset().mockResolvedValue(current);
  updateMany.mockReset().mockResolvedValue({ count: 1 });
});

it('publishes using a saved introduction without changing name or identity', async () => {
  await updateProfile(prisma as never, 'clerk', {
    profilePublished: true,
    shareCurrentBook: true,
  });
  expect(updateMany).toHaveBeenCalledWith({
    where: { clerkUserId: 'clerk' },
    data: { profilePublished: true, shareCurrentBook: true },
  });
});
it('rejects publishing without a nonblank introduction', async () => {
  findUnique.mockResolvedValue({ introduction: null, profilePublished: false });
  await expect(
    updateProfile(prisma as never, 'clerk', { profilePublished: true }),
  ).rejects.toBeInstanceOf(BadRequestException);
  expect(updateMany).not.toHaveBeenCalled();
});
it('rejects clearing the introduction of a published profile', async () => {
  findUnique.mockResolvedValue({ ...current, profilePublished: true });
  await expect(
    updateProfile(prisma as never, 'clerk', { introduction: '  ' }),
  ).rejects.toBeInstanceOf(BadRequestException);
  expect(updateMany).not.toHaveBeenCalled();
});
it('hides a profile without deleting the saved introduction or sharing preference', async () => {
  await updateProfile(prisma as never, 'clerk', { profilePublished: false });
  expect(updateMany).toHaveBeenCalledWith({
    where: { clerkUserId: 'clerk' },
    data: { profilePublished: false },
  });
});
it('accepts 180 Unicode code points and trims the introduction', async () => {
  await updateProfile(prisma as never, 'clerk', {
    introduction: ` ${'📚'.repeat(180)} `,
  });
  expect(updateMany).toHaveBeenCalledWith(
    expect.objectContaining({ data: { introduction: '📚'.repeat(180) } }),
  );
});
it.each([
  { introduction: 'A'.repeat(181) },
  { introduction: '📚'.repeat(181) },
  { profilePublished: 'yes' },
  { shareCurrentBook: 1 },
  {},
])('rejects invalid social fields', async (body) => {
  await expect(
    updateProfile(prisma as never, 'clerk', body),
  ).rejects.toBeInstanceOf(BadRequestException);
  expect(updateMany).not.toHaveBeenCalled();
});
