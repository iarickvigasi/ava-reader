import { readCurrentReadingBook } from './read-current-reading-book';
import { UsersService } from './users.service';

const findFirst = jest.fn();
const findUnique = jest.fn();
const prisma = { readingProgress: { findFirst }, user: { findUnique } };
beforeEach(() => jest.resetAllMocks());

it('selects the most recently read active unfinished book for the authenticated user', async () => {
  findFirst.mockResolvedValue({
    libraryItemId: 'book-2',
    lastReadAt: new Date('2026-10-08T10:00:00Z'),
    libraryItem: { book: { title: 'Another book', authors: ['Author A'] } },
  });
  expect(await readCurrentReadingBook(prisma as never, 'user-1')).toEqual({
    libraryItemId: 'book-2',
    title: 'Another book',
    authors: ['Author A'],
    lastReadAt: '2026-10-08T10:00:00.000Z',
  });
  expect(findFirst).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        userId: 'user-1',
        lastReadAt: { not: null },
        completionPercent: { lt: 100 },
        libraryItem: { isArchived: false, finishedAt: null },
      },
      orderBy: [{ lastReadAt: 'desc' }, { libraryItemId: 'asc' }],
    }),
  );
});
it('omits book titles when sharing is disabled and derives them afresh when enabled', async () => {
  const user = {
    id: 'u',
    roleMemberships: [],
    updatedAt: new Date(),
    introduction: 'Reader',
    profilePublished: true,
    shareCurrentBook: false,
  };
  findUnique.mockResolvedValue(user);
  const service = new UsersService(prisma as never, {} as never);
  expect((await service.getCurrentUser('clerk')).currentReadingBook).toBeNull();
  expect(findFirst).not.toHaveBeenCalled();
  findUnique.mockResolvedValue({ ...user, shareCurrentBook: true });
  findFirst.mockResolvedValue(null);
  expect((await service.getCurrentUser('clerk')).currentReadingBook).toBeNull();
  expect(findFirst).toHaveBeenCalledTimes(1);
});
