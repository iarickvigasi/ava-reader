import type { PrismaService } from '../../../prisma/prisma.service';
export async function pdfJobMetrics(prisma: PrismaService) {
  const [clock] = await prisma.$queryRaw<
    { now: Date }[]
  >`SELECT clock_timestamp() AS now`;
  const now = clock.now;
  const [
    states,
    retries,
    pendingNotifications,
    activeLeases,
    expiredLeases,
    oldest,
    resourceFailures,
  ] = await Promise.all([
    prisma.pdfConversionJob.groupBy({ by: ['state'], _count: true }),
    prisma.pdfJobAttempt.count({
      where: { status: { in: ['RETRY', 'EXPIRED'] } },
    }),
    prisma.pdfNotificationIntent.count({ where: { status: 'PENDING' } }),
    prisma.pdfJobAttempt.count({
      where: {
        status: 'RUNNING',
        leaseExpiresAt: { gt: now },
        deadlineAt: { gt: now },
      },
    }),
    prisma.pdfJobAttempt.count({
      where: {
        status: 'RUNNING',
        OR: [{ leaseExpiresAt: { lte: now } }, { deadlineAt: { lte: now } }],
      },
    }),
    prisma.pdfConversionJob.findFirst({
      where: { state: 'QUEUED' },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }),
    prisma.pdfJobFailure.groupBy({
      by: ['code'],
      where: { code: { in: ['RESOURCE_LIMIT', 'EXECUTION_TIMEOUT'] } },
      _count: true,
    }),
  ]);
  return {
    snapshot: 'approximate',
    observedAt: now,
    states,
    retries,
    pendingNotifications,
    activeLeases,
    expiredLeases,
    oldestQueuedAgeMs: oldest
      ? Math.max(0, now.getTime() - oldest.createdAt.getTime())
      : null,
    resourceFailures,
  };
}
