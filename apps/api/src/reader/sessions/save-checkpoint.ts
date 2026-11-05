import type { PrismaService } from '../../prisma/prisma.service';
import type { ReadingCheckpoint } from './checkpoint-types';
import { assertCheckpointAccess } from './checkpoint-access';
import { advanceReadingRevision } from './reading-revision';
import { lockCheckpoint } from './lock-checkpoint';
import { loadCheckpointSession } from './load-checkpoint-session';
import { creditCheckpoint } from './credit-checkpoint';
import { persistCheckpoint } from './persist-checkpoint';

export async function saveReadingCheckpoint(
  prisma: PrismaService,
  userId: string,
  libraryItemId: string,
  checkpoint: ReadingCheckpoint,
) {
  return prisma.$transaction(async (tx) => {
    await lockCheckpoint(tx, userId, libraryItemId, checkpoint.clientSessionId);
    await assertCheckpointAccess(
      tx,
      userId,
      libraryItemId,
      !!checkpoint.endedAt,
    );
    const { session, changed } = await loadCheckpointSession(tx, {
      userId,
      libraryItemId,
      checkpoint,
    });
    if (!changed) return response(session);
    await creditCheckpoint(tx, session, checkpoint.durationSeconds);
    const updated = await persistCheckpoint(tx, session.id, checkpoint);
    await advanceReadingRevision(tx, userId);
    return response(updated);
  });
}

function response(session: {
  id: string;
  checkpointRevision: number;
  durationSeconds: number;
}) {
  return {
    sessionId: session.id,
    revision: session.checkpointRevision,
    durationSeconds: session.durationSeconds,
  };
}
