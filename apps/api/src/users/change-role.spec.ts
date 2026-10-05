import { changeRole } from './change-role';

const findMany = jest.fn();
const createMany = jest.fn();
const deleteMany = jest.fn();
const prisma = {
  user: { findMany },
  userRoleMembership: { createMany, deleteMany },
};
beforeEach(() => {
  jest.resetAllMocks();
  findMany.mockResolvedValue([
    { id: 'user', primaryEmail: 'ada@example.test' },
  ]);
});
it('grants with conflict-safe inserts without replacing existing memberships', async () => {
  await Promise.all(
    ['ADMIN', 'DEVELOPER', 'ADMIN'].map((role) =>
      changeRole(prisma as never, {
        identifier: 'ada@example.test',
        role: role as 'ADMIN' | 'DEVELOPER',
        action: 'grant',
      }),
    ),
  );
  expect(createMany).toHaveBeenCalledTimes(3);
  expect(createMany).toHaveBeenCalledWith({
    data: [{ userId: 'user', role: 'ADMIN' }],
    skipDuplicates: true,
  });
  expect(createMany).toHaveBeenCalledWith({
    data: [{ userId: 'user', role: 'DEVELOPER' }],
    skipDuplicates: true,
  });
  expect(deleteMany).not.toHaveBeenCalled();
});
it('revokes only the requested role and is safe when membership is absent', async () => {
  deleteMany.mockResolvedValue({ count: 0 });
  for (let i = 0; i < 2; i++)
    await changeRole(prisma as never, {
      identifier: 'clerk',
      role: 'ADMIN',
      action: 'revoke',
    });
  expect(deleteMany).toHaveBeenCalledWith({
    where: { userId: 'user', role: 'ADMIN' },
  });
  expect(createMany).not.toHaveBeenCalled();
});
it.each([{ users: [] }, { users: [{ id: 'one' }, { id: 'two' }] }])(
  'rejects missing or ambiguous users',
  async ({ users }) => {
    findMany.mockResolvedValue(users);
    await expect(
      changeRole(prisma as never, {
        identifier: 'email',
        role: 'ADMIN',
        action: 'grant',
      }),
    ).rejects.toThrow('exactly one');
    expect(createMany).not.toHaveBeenCalled();
    expect(deleteMany).not.toHaveBeenCalled();
  },
);
