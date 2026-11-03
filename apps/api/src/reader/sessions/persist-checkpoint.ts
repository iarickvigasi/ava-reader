import type { Prisma } from '@prisma/client';
import type { ReadingCheckpoint } from './checkpoint-types';

export function persistCheckpoint(
  tx: Prisma.TransactionClient,
  sessionId: string,
  checkpoint: ReadingCheckpoint,
) {
  return tx.readingSession.update({
    where: { id: sessionId },
    data: {
      checkpointRevision: checkpoint.revision,
      durationSeconds: checkpoint.durationSeconds,
      durationMinutes: Math.floor(checkpoint.durationSeconds / 60),
      lastTrackedAt: checkpoint.checkpointAt,
      endedAt: checkpoint.endedAt,
    },
  });
}
