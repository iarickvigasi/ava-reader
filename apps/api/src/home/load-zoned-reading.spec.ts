import { loadZonedReading } from './load-zoned-reading';

function database() {
  return {
    $transaction: jest.fn((reads: Promise<unknown>[]) => Promise.all(reads)),
    readingSessionSegment: {
      findMany: jest.fn().mockResolvedValue([
        {
          trackedDay: new Date('2026-09-24T00:00:00Z'),
          durationSeconds: 2400,
        },
      ]),
      aggregate: jest
        .fn()
        .mockResolvedValue({ _sum: { durationSeconds: 2400 } }),
      findFirst: jest
        .fn()
        .mockResolvedValue({ trackedDay: new Date('2026-09-24T00:00:00Z') }),
    },
    readingSessionInterval: {
      findMany: jest.fn().mockResolvedValue([
        {
          startedAt: new Date('2026-09-24T22:10:00Z'),
          endedAt: new Date('2026-09-24T22:50:00Z'),
          readingSession: { timeZone: 'Europe/Belgrade' },
        },
      ]),
    },
    readingSession: {
      findMany: jest.fn().mockResolvedValue([{ clientSessionId: 'replay' }]),
    },
  };
}

afterEach(() => jest.useRealTimers());
it('reads identities, intervals and totals in one owner-scoped repeatable snapshot', async () => {
  jest.useFakeTimers().setSystemTime(Date.parse('2026-09-24T22:58:00Z'));
  const db = database();
  const snapshot = await loadZonedReading(
    db as never,
    'owner',
    'Europe/Belgrade',
  );
  expect(snapshot.days.at(-1)).toEqual({ key: '2026-09-25', seconds: 2400 });
  expect(snapshot.totalSeconds).toBe(2400);
  expect(snapshot.clientSessionIds).toEqual(['replay']);
  expect(snapshot.nextBefore).toBeNull();
  expect(db.$transaction).toHaveBeenCalledWith(expect.any(Array), {
    isolationLevel: 'RepeatableRead',
  });
  expect(db.readingSessionInterval.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        readingSession: { userId: 'owner' },
      }) as unknown,
    }),
  );
  expect(db.readingSession.findMany).toHaveBeenCalledWith({
    where: { userId: 'owner', clientSessionId: { not: null } },
    select: { clientSessionId: true },
  });
});
it('stops at the earliest local day without an extra empty history week', async () => {
  const db = database();
  const snapshot = await loadZonedReading(
    db as never,
    'owner',
    'Europe/Belgrade',
    '2026-10-02',
  );
  expect(snapshot.days[0]).toEqual({ key: '2026-09-25', seconds: 2400 });
  expect(snapshot.nextBefore).toBeNull();
});
