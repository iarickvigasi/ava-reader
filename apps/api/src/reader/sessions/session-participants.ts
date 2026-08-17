import type { Prisma } from '@prisma/client';
import type { LockedSessionRecord } from './session-record';

// A client that stops heartbeating for this long (crashed tab, closed laptop)
// is treated as gone, so its silence stops accruing reading time.
const SESSION_PARTICIPANT_IDLE_TIMEOUT_MS = 90_000;

export function participantActivityCutoff(now: Date): Date {
  return new Date(now.getTime() - SESSION_PARTICIPANT_IDLE_TIMEOUT_MS);
}

export async function retireIdleParticipantsTx(
  tx: Prisma.TransactionClient,
  sessionId: string,
  now: Date,
  cutoff: Date,
) {
  await tx.readingSessionParticipant.updateMany({
    where: {
      readingSessionId: sessionId,
      stoppedAt: null,
      lastSeenAt: {
        lt: cutoff,
      },
    },
    data: {
      stoppedAt: now,
    },
  });
}

export function countActiveParticipantsTx(
  tx: Prisma.TransactionClient,
  sessionId: string,
  cutoff: Date,
) {
  return tx.readingSessionParticipant.count({
    where: {
      readingSessionId: sessionId,
      stoppedAt: null,
      lastSeenAt: {
        gte: cutoff,
      },
    },
  });
}

// `stoppedAt` is the only thing that differs between retiring this client on a
// stop and (re)marking it live on a start or heartbeat.
export async function markParticipantSeenTx(
  tx: Prisma.TransactionClient,
  session: LockedSessionRecord,
  clientInstanceId: string,
  now: Date,
  stoppedAt: Date | null,
) {
  await tx.readingSessionParticipant.upsert({
    where: {
      readingSessionId_clientInstanceId: {
        readingSessionId: session.id,
        clientInstanceId,
      },
    },
    update: {
      lastSeenAt: now,
      stoppedAt,
    },
    create: {
      clientInstanceId,
      lastSeenAt: now,
      libraryItemId: session.libraryItemId,
      readingSessionId: session.id,
      stoppedAt,
      userId: session.userId,
    },
  });
}
