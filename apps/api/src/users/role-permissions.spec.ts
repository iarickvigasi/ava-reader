import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { UsersService } from './users.service';
import { updateProfile } from './update-profile';

const cases: UserRole[][] = [
  [],
  ['ADMIN'],
  ['DEVELOPER'],
  ['ADMIN', 'DEVELOPER'],
];
it.each(cases.map((roles) => [roles]))(
  'checks admin and developer permissions independently: %j',
  async (roles) => {
    const user = {
      id: 'user',
      clerkUserId: 'clerk',
      displayName: 'Ada',
      displayNameOverride: null,
      primaryEmail: 'ada@example.test',
      avatarUrl: null,
      telegramUrl: null,
      updatedAt: new Date(),
      roleMemberships: roles.map((role) => ({ role })),
    };
    const findUnique = jest.fn().mockResolvedValue(user);
    const service = new UsersService(
      { user: { findUnique } } as never,
      {} as never,
    );
    expect((await service.getCurrentUser('clerk')).roles).toEqual(roles);
    if (roles.includes('ADMIN'))
      await expect(service.assertAdmin('clerk')).resolves.toMatchObject({
        id: 'user',
      });
    else
      await expect(service.assertAdmin('clerk')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    const updateMany = jest
      .fn()
      .mockResolvedValue({ count: roles.includes('DEVELOPER') ? 1 : 0 });
    const tx = { user: { updateMany, findUnique } };
    const save = updateProfile(
      {
        $transaction: (run: (value: typeof tx) => unknown) => run(tx),
      } as never,
      'clerk',
      {
        displayName: 'Ada',
        telegramUrl: null,
      },
    );
    if (roles.includes('DEVELOPER'))
      await expect(save).resolves.toBeUndefined();
    else await expect(save).rejects.toBeInstanceOf(ForbiddenException);
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          clerkUserId: 'clerk',
          roleMemberships: { some: { role: 'DEVELOPER' } },
        },
      }),
    );
  },
);
it('rechecks memberships after admin revocation', async () => {
  const findUnique = jest
    .fn()
    .mockResolvedValueOnce({
      updatedAt: new Date(),
      roleMemberships: [{ role: 'ADMIN' }, { role: 'DEVELOPER' }],
    })
    .mockResolvedValueOnce({
      updatedAt: new Date(),
      roleMemberships: [{ role: 'DEVELOPER' }],
    });
  const service = new UsersService(
    { user: { findUnique } } as never,
    {} as never,
  );
  await expect(service.assertAdmin('clerk')).resolves.toBeDefined();
  await expect(service.assertAdmin('clerk')).rejects.toBeInstanceOf(
    ForbiddenException,
  );
});
