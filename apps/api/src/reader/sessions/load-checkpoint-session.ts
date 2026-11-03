import type { Prisma } from '@prisma/client';
import type { ReadingCheckpoint } from './checkpoint-types';
import { checkpointShouldAdvance } from './checkpoint-transition';
import { startOfDay } from '../../shared/date-utils';

export async function loadCheckpointSession(
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    libraryItemId: string;
    checkpoint: ReadingCheckpoint;
  },
) {
  const { userId, libraryItemId, checkpoint } = input;
  const existing = await tx.readingSession.findUnique({
    where: {
      userId_clientSessionId: {
        userId,
        clientSessionId: checkpoint.clientSessionId,
      },
    },
  });
  if (existing) {
    return {
      session: existing,
      changed: checkpointShouldAdvance(existing, checkpoint, libraryItemId),
    };
  }
  const session = await tx.readingSession.create({
    data: {
      userId,
      libraryItemId,
      clientSessionId: checkpoint.clientSessionId,
      trackingVersion: 2,
      startedAt: checkpoint.startedAt,
      timeZone: checkpoint.timeZone,
      trackedDay: startOfDay(checkpoint.startedAt),
    },
  });
  return { session, changed: true };
}
