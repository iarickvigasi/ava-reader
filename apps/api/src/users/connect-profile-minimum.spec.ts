import { BadRequestException } from '@nestjs/common';
import { updateProfile } from './update-profile';

const findUnique = jest.fn();
const updateMany = jest.fn();
const tx = { user: { findUnique, updateMany } };
const prisma = {
  $transaction: (run: (value: typeof tx) => unknown) => run(tx),
};
beforeEach(() => {
  findUnique
    .mockReset()
    .mockResolvedValue({ introduction: '', profilePublished: false });
  updateMany.mockReset().mockResolvedValue({ count: 1 });
});
it.each(['a'.repeat(49), ' ' + 'a'.repeat(49) + ' ', '📚'.repeat(49)])(
  'rejects publishing below 50 trimmed code points',
  async (introduction) => {
    await expect(
      updateProfile(prisma as never, 'clerk', {
        introduction,
        profilePublished: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(updateMany).not.toHaveBeenCalled();
  },
);
it.each(['a'.repeat(50), '📚'.repeat(50)])(
  'accepts publishing at 50 code points',
  async (introduction) => {
    await updateProfile(prisma as never, 'clerk', {
      introduction,
      profilePublished: true,
    });
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { introduction, profilePublished: true },
      }),
    );
  },
);
it('prevents shortening a published description below the minimum', async () => {
  findUnique.mockResolvedValue({
    introduction: 'a'.repeat(50),
    profilePublished: true,
  });
  await expect(
    updateProfile(prisma as never, 'clerk', { introduction: 'a'.repeat(49) }),
  ).rejects.toBeInstanceOf(BadRequestException);
});
it('allows hiding a legacy short profile and preserves its description', async () => {
  findUnique.mockResolvedValue({
    introduction: 'Short',
    profilePublished: true,
  });
  await updateProfile(prisma as never, 'clerk', { profilePublished: false });
  expect(updateMany).toHaveBeenCalledWith(
    expect.objectContaining({ data: { profilePublished: false } }),
  );
});
