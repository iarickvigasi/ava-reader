import { loadBookReadingSnapshot } from './load-book-reading-snapshot';

it('pairs exact book seconds with the coverage and revision of that same snapshot', async () => {
  const tx = {
    readingSession: {
      findMany: jest.fn().mockResolvedValue([
        { clientSessionId: 'laptop', trackingVersion: 1, durationSeconds: 600 },
        { clientSessionId: 'phone', trackingVersion: 2, durationSeconds: 300 },
      ]),
    },
    readingSessionSegment: {
      aggregate: jest
        .fn()
        .mockResolvedValue({ _sum: { durationSeconds: 900 } }),
    },
    user: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({ readingRevision: 4 }),
    },
  };
  expect(await loadBookReadingSnapshot(tx as never, 'user', 'book')).toEqual({
    clientSessionIds: ['laptop', 'phone'],
    sessionCoverage: [{ clientSessionId: 'phone', durationSeconds: 300 }],
    readingRevision: 4,
    totalSeconds: 900,
  });
  expect(tx.readingSessionSegment.aggregate).toHaveBeenCalledWith({
    where: { userId: 'user', libraryItemId: 'book' },
    _sum: { durationSeconds: true },
  });
  expect(tx.user.findUniqueOrThrow).toHaveBeenCalledWith({
    where: { id: 'user' },
    select: { readingRevision: true },
  });
});
