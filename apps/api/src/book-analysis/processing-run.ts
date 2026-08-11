import { ProcessingStatus } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';

export type ClaimedRun = { bookId: string; id: string };

/**
 * Claims the oldest pending run for a pipeline, or returns null.
 *
 * The claim is a conditional `updateMany` rather than a read-then-write so two
 * API instances polling the same table cannot both take the same run.
 */
export async function claimNextRun(input: {
  pipeline: string;
  prisma: PrismaService;
}): Promise<ClaimedRun | null> {
  const { pipeline, prisma } = input;
  const pending = await prisma.bookProcessingRun.findFirst({
    where: { pipeline, status: ProcessingStatus.PENDING },
    orderBy: { createdAt: 'asc' },
    select: { bookId: true, id: true },
  });

  if (!pending) {
    return null;
  }

  const claimed = await prisma.bookProcessingRun.updateMany({
    where: { id: pending.id, status: ProcessingStatus.PENDING },
    data: {
      completedAt: null,
      errorMessage: null,
      status: ProcessingStatus.PROCESSING,
    },
  });

  return claimed.count === 0 ? null : pending;
}

export async function closeRun(input: {
  errorMessage: null | string;
  prisma: PrismaService;
  runId: string;
}): Promise<void> {
  await input.prisma.bookProcessingRun.update({
    where: { id: input.runId },
    data: {
      completedAt: new Date(),
      errorMessage: input.errorMessage,
      status: input.errorMessage
        ? ProcessingStatus.FAILED
        : ProcessingStatus.READY,
    },
  });
}
