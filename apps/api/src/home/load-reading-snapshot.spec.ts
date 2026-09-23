import { loadReadingSnapshot } from './load-reading-snapshot';

it('reads all-time identities, totals and daily segments in one user-scoped snapshot', async () => {
  const prisma = {
    $transaction: jest.fn((reads: Promise<unknown>[]) => Promise.all(reads)),
    readingSession: {
      findMany: jest
        .fn()
        .mockResolvedValue([
          { clientSessionId: 'old-offline-session' },
          { clientSessionId: 'recent-session' },
        ]),
    },
    readingSessionSegment: {
      aggregate: jest
        .fn()
        .mockResolvedValue({ _sum: { durationSeconds: 9001 } }),
      findMany: jest.fn().mockResolvedValue([
        {
          trackedDay: new Date('2026-04-13T00:00:00Z'),
          durationSeconds: 1801,
        },
      ]),
    },
  };
  const { readingSnapshot } = await loadReadingSnapshot(
    prisma as never,
    'user-1',
  );
  expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Array), {
    isolationLevel: 'RepeatableRead',
  });
  expect(prisma.readingSession.findMany).toHaveBeenCalledWith({
    where: { userId: 'user-1', clientSessionId: { not: null } },
    select: { clientSessionId: true },
  });
  expect(prisma.readingSessionSegment.aggregate).toHaveBeenCalledWith({
    where: { userId: 'user-1' },
    _sum: { durationSeconds: true },
  });
  expect(prisma.readingSessionSegment.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        userId: 'user-1',
        trackedDay: { gte: expect.any(Date) as unknown },
      },
    }),
  );
  expect(readingSnapshot).toEqual({
    clientSessionIds: ['old-offline-session', 'recent-session'],
    totalSeconds: 9001,
    days: [{ key: '2026-04-13', seconds: 1801 }],
  });
});
