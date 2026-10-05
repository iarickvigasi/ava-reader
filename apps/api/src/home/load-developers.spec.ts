import { loadDevelopers } from './load-developers';

it('queries only developers with Telegram and exposes only contact fields', async () => {
  const findMany = jest.fn().mockResolvedValue([
    {
      id: '1',
      displayName: 'Clerk name',
      displayNameOverride: 'Ada',
      avatarUrl: null,
      telegramUrl: 'https://t.me/ava_dev/',
    },
    {
      id: '2',
      displayName: 'Ben',
      avatarUrl: 'https://images.test/ben',
      telegramUrl: 'https://t.me/ava_ben',
    },
    { id: '3', displayName: null, telegramUrl: 'https://t.me/ava_dev' },
    { id: '4', displayName: 'Invalid', telegramUrl: 'https://bad.test/abc' },
  ]);
  expect(await loadDevelopers({ user: { findMany } } as never)).toEqual([
    {
      id: '1',
      displayName: 'Ada',
      avatarUrl: null,
      telegramUrl: 'https://t.me/ava_dev',
    },
    {
      id: '2',
      displayName: 'Ben',
      avatarUrl: 'https://images.test/ben',
      telegramUrl: 'https://t.me/ava_ben',
    },
  ]);
  expect(findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { role: 'DEVELOPER', telegramUrl: { not: null } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
  );
});
