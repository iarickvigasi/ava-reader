import type { Prisma } from '@prisma/client';
import { lockActiveSessionTx } from './lock-session';
import {
  lockedSessionSelect,
  type LockedSessionRecord,
} from './session-record';
import { startOfUtcDay } from './session-segments';

// Returns the session already open for this book, or opens one. Two clients
// starting at once race on the create; the loser adopts the winner's row.
export async function findOrCreateActiveSessionTx(
  tx: Prisma.TransactionClient,
  params: {
    clientSessionId: string | null;
    libraryItemId: string;
    replayEnd: Date | null;
    startedAt: Date;
    userId: string;
  },
): Promise<LockedSessionRecord | null> {
  const existing = await lockActiveSessionTx(
    tx,
    params.userId,
    params.libraryItemId,
  );
  if (existing) {
    return existing;
  }

  try {
    return await tx.readingSession.create({
      data: {
        durationMinutes: 0,
        durationSeconds: 0,
        lastTrackedAt: params.replayEnd ?? params.startedAt,
        endedAt: params.replayEnd,
        libraryItemId: params.libraryItemId,
        startedAt: params.startedAt,
        trackedDay: startOfUtcDay(params.startedAt),
        userId: params.userId,
        clientSessionId: params.clientSessionId,
      },
      select: lockedSessionSelect,
    });
  } catch (error) {
    const recovered = await lockActiveSessionTx(
      tx,
      params.userId,
      params.libraryItemId,
    );
    if (!recovered) {
      throw error;
    }
    return recovered;
  }
}
