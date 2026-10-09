import { readPublishedReaders } from './read-published-readers';

const findMany = jest.fn();
const findFirst = jest.fn();
const prisma = {
  user: { findMany },
  readingProgress: { findFirst },
};

beforeEach(() => {
  findMany.mockReset();
  findFirst.mockReset();
});

it('returns only published, explicitly shared profile fields', async () => {
  findMany.mockResolvedValue([
    {
      id: 'one',
      displayName: 'Old name',
      displayNameOverride: 'Ada',
      avatarUrl: 'https://example.test/avatar.png',
      introduction: 'I enjoy thoughtful books.',
      shareCurrentBook: true,
      primaryEmail: 'private@example.test',
      annotations: [{ excerpt: 'private' }],
    },
    {
      id: 'two',
      displayName: 'Bea',
      displayNameOverride: null,
      avatarUrl: null,
      introduction: 'I read widely.',
      shareCurrentBook: false,
    },
  ]);
  findFirst.mockResolvedValue({
    libraryItemId: 'secret-id',
    lastReadAt: new Date(),
    libraryItem: { book: { title: 'A Book', authors: ['A Writer'] } },
  });

  const readers = await readPublishedReaders(prisma as never);

  expect(findMany).toHaveBeenCalledWith({
    where: { profilePublished: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      displayName: true,
      displayNameOverride: true,
      avatarUrl: true,
      introduction: true,
      shareCurrentBook: true,
    },
  });
  expect(findFirst).toHaveBeenCalledTimes(1);
  expect(readers).toEqual([
    {
      id: 'one',
      displayName: 'Ada',
      avatarUrl: 'https://example.test/avatar.png',
      introduction: 'I enjoy thoughtful books.',
      currentBook: { title: 'A Book', authors: ['A Writer'] },
    },
    {
      id: 'two',
      displayName: 'Bea',
      avatarUrl: null,
      introduction: 'I read widely.',
      currentBook: null,
    },
  ]);
});
