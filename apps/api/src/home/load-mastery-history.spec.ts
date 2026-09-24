import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { loadMasteryHistory } from './load-mastery-history';

function setup(earliest: string | null, segments: unknown[] = []) {
  const findMany = jest.fn();
  const prisma = {
    readingSessionSegment: { findMany, findFirst: jest.fn() },
    readingSession: { findMany: jest.fn() },
    $transaction: jest
      .fn()
      .mockResolvedValue([
        segments,
        earliest ? { trackedDay: new Date(earliest) } : null,
        [{ clientSessionId: 'covered-session' }],
      ]),
  };
  return { prisma: prisma as unknown as PrismaService, findMany };
}

describe('mastery history', () => {
  it('uses an exclusive UTC cursor across month boundaries and retains empty weeks', async () => {
    const { prisma, findMany } = setup('2025-01-01');
    const page = await loadMasteryHistory(prisma, 'user', '2026-03-03');
    expect(page.days).toHaveLength(7);
    expect(page.days[0]).toEqual({ key: '2026-02-24', seconds: 0 });
    expect(page.days[6].key).toBe('2026-03-02');
    expect(page.nextBefore).toBe('2026-02-24');
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'user',
          trackedDay: {
            gte: new Date('2026-02-24'),
            lt: new Date('2026-03-03'),
          },
        },
      }),
    );
  });
  it('sums seconds and ends at the earliest week', async () => {
    const { prisma } = setup('2026-02-25', [
      { trackedDay: new Date('2026-02-25'), durationSeconds: 40 },
      { trackedDay: new Date('2026-02-25'), durationSeconds: 30 },
    ]);
    const page = await loadMasteryHistory(prisma, 'user', '2026-03-03');
    expect(page.days[1].seconds).toBe(70);
    expect(page.clientSessionIds).toEqual(['covered-session']);
    expect(page.nextBefore).toBeNull();
  });
  it('ends for a user without sessions', async () => {
    expect(
      (await loadMasteryHistory(setup(null).prisma, 'user', '2026-03-03'))
        .nextBefore,
    ).toBeNull();
  });
  it.each(['bad', '2026-02-30', '2026-13-01', undefined])(
    'rejects invalid cursor %s',
    async (before) => {
      await expect(
        loadMasteryHistory(setup(null).prisma, 'user', before as string),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );
});
