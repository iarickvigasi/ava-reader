import { loadHomeActivity } from './load-home-activity';

describe('home completion statistics', () => {
  it('counts each library item once and includes manual completion without progress', async () => {
    const finishedAt = new Date('2020-01-01T00:00:00.000Z');
    const findMany = jest.fn().mockResolvedValue([
      { id: 'unread', finishedAt: null, progress: { completionPercent: 99 } },
      { id: 'manual', finishedAt, progress: null },
      {
        id: 'progress',
        finishedAt: null,
        progress: { completionPercent: 100 },
      },
      { id: 'both', finishedAt, progress: { completionPercent: 100 } },
      { id: 'archived', finishedAt, progress: { completionPercent: 20 } },
    ]);
    const prisma = {
      libraryItem: { findMany },
      readingSessionSegment: {
        findMany: jest.fn().mockResolvedValue([]),
        aggregate: jest
          .fn()
          .mockResolvedValue({ _sum: { durationSeconds: 0 } }),
      },
      annotation: { count: jest.fn().mockResolvedValue(0) },
      aiComment: { count: jest.fn().mockResolvedValue(0) },
    };
    const result = await loadHomeActivity(prisma as never, 'user-1');

    expect(result.stats.volumesRead).toBe(4);
    expect(result.completionItems).toEqual([
      { libraryItemId: 'unread', finishedAt: null, completionPercent: 99 },
      {
        libraryItemId: 'manual',
        finishedAt: finishedAt.toISOString(),
        completionPercent: 0,
      },
      { libraryItemId: 'progress', finishedAt: null, completionPercent: 100 },
      {
        libraryItemId: 'both',
        finishedAt: finishedAt.toISOString(),
        completionPercent: 100,
      },
      {
        libraryItemId: 'archived',
        finishedAt: finishedAt.toISOString(),
        completionPercent: 20,
      },
    ]);
    // No date or archive filter: completion totals remain all-time. A single
    // source read keeps the returned item snapshots and aggregate coherent.
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      select: {
        id: true,
        finishedAt: true,
        progress: { select: { completionPercent: true } },
      },
    });
  });
});
