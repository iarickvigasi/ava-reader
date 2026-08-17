import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import { applySessionActionTx } from './apply-session-action';
import { findOrCreateActiveSessionTx } from './find-or-create-active-session';
import type { ResolvedOfflineReplay } from './resolve-offline-replay';
import { replayCompletedSessionTx } from './replay-completed-session';
import {
  lockedSessionSelect,
  type LockedSessionRecord,
} from './session-record';

export async function startReadingSession(params: {
  clientInstanceId: string;
  libraryItemId: string;
  now: Date;
  prisma: PrismaService;
  replay: ResolvedOfflineReplay;
  userId: string;
}): Promise<LockedSessionRecord> {
  const { clientInstanceId, libraryItemId, now, prisma, replay, userId } =
    params;
  const sessionStartedAt = replay.startedAt ?? now;

  return prisma.$transaction(async (tx) => {
    // Offline replay of a completed session: record it with its original
    // timestamps and real duration, immutably (a retry returns the existing
    // row). Kept entirely off the live 'start' action, which would reopen and
    // re-date the row to "now."
    if (
      replay.isReplay &&
      replay.clientSessionId &&
      replay.startedAt &&
      replay.endedAt
    ) {
      return replayCompletedSessionTx(tx, {
        clientSessionId: replay.clientSessionId,
        durationSeconds: replay.durationSeconds,
        endedAt: replay.endedAt,
        libraryItemId,
        startedAt: replay.startedAt,
        userId,
      });
    }

    // Live session with a stable client id: a second POST with the same id
    // resumes the existing row. Distinct from the "active session" lookup
    // below because a resumed session may already be `endedAt`.
    if (replay.clientSessionId) {
      const existing = await tx.readingSession.findFirst({
        where: { userId, clientSessionId: replay.clientSessionId },
        select: lockedSessionSelect,
      });
      if (existing) {
        return applySessionActionTx(
          tx,
          existing,
          now,
          clientInstanceId,
          'start',
        );
      }
    }

    const activeSession = await findOrCreateActiveSessionTx(tx, {
      clientSessionId: replay.clientSessionId,
      libraryItemId,
      replayEnd: replay.endedAt,
      startedAt: sessionStartedAt,
      userId,
    });

    if (!activeSession) {
      throw new NotFoundException('The reading session was not found.');
    }

    return applySessionActionTx(
      tx,
      activeSession,
      now,
      clientInstanceId,
      'start',
    );
  });
}
