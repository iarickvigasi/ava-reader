import type { Prisma } from '@prisma/client';

export async function recordReadingInterval(
  tx: Prisma.TransactionClient,
  readingSessionId: string,
  start: Date,
  seconds: number,
) {
  if (seconds <= 0) return;
  const startedAt = new Date(Math.floor(start.getTime() / 1000) * 1000);
  const endedAt = new Date(startedAt.getTime() + seconds * 1000);
  const adjacent = await tx.readingSessionInterval.findFirst({
    where: { readingSessionId, endedAt: startedAt },
    select: { id: true },
  });
  if (adjacent) {
    await tx.readingSessionInterval.update({
      where: { id: adjacent.id },
      data: { endedAt },
    });
  } else {
    await tx.readingSessionInterval.create({
      data: { readingSessionId, startedAt, endedAt },
    });
  }
}
