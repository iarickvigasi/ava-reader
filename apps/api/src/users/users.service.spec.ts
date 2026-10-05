import { UsersService } from './users.service';

const findUnique = jest.fn();
const upsert = jest.fn();
const getUser = jest.fn();
const service = new UsersService(
  { user: { findUnique, upsert } } as never,
  { getUser } as never,
);
const flush = () => new Promise((resolve) => setImmediate(resolve));
beforeEach(() => {
  jest.resetAllMocks();
  getUser.mockResolvedValue({
    primaryEmailAddress: { emailAddress: 'reader@example.test' },
  });
});
it('returns a fresh DB user without calling Clerk', async () => {
  findUnique.mockResolvedValue({
    id: 'local',
    updatedAt: new Date(),
    roleMemberships: [],
  });
  expect(await service.getCurrentUserRecord('clerk')).toMatchObject({
    id: 'local',
    roles: [],
  });
  await flush();
  expect(getUser).not.toHaveBeenCalled();
  expect(upsert).not.toHaveBeenCalled();
});
it.each([false, true])(
  'returns stale DB data while refreshing in the background (failure: %s)',
  async (fails) => {
    findUnique.mockResolvedValue({
      id: 'local',
      updatedAt: new Date(0),
      roleMemberships: [],
    });
    if (fails) getUser.mockRejectedValue(new Error('offline'));
    expect(await service.getCurrentUserRecord('clerk')).toMatchObject({
      id: 'local',
      roles: [],
    });
    await flush();
    expect(getUser).toHaveBeenCalledWith('clerk');
    if (fails) expect(upsert).not.toHaveBeenCalled();
    else expect(upsert).toHaveBeenCalled();
  },
);
