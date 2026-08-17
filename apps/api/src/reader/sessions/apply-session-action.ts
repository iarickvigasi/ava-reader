import type { Prisma } from '@prisma/client';
import {
  countActiveParticipantsTx,
  markParticipantSeenTx,
  participantActivityCutoff,
  retireIdleParticipantsTx,
} from './session-participants';
import {
  lockedSessionSelect,
  type LockedSessionRecord,
} from './session-record';
import {
  computeElapsedSeconds,
  incrementSessionSegmentsTx,
  startOfUtcDay,
} from './session-segments';
import { syncReadingProgressMinutesTx } from './sync-progress-minutes';

type SessionAction = 'heartbeat' | 'start' | 'stop';

export async function applySessionActionTx(
  tx: Prisma.TransactionClient,
  session: LockedSessionRecord,
  now: Date,
  clientInstanceId: string,
  action: SessionAction,
): Promise<LockedSessionRecord> {
  const cutoff = participantActivityCutoff(now);
  await retireIdleParticipantsTx(tx, session.id, now, cutoff);

  // Time only accrues if someone was actually reading before this action.
  const elapsedSeconds =
    (await countActiveParticipantsTx(tx, session.id, cutoff)) > 0
      ? computeElapsedSeconds(session.lastTrackedAt ?? now, now)
      : 0;

  if (elapsedSeconds > 0) {
    await incrementSessionSegmentsTx(
      tx,
      session,
      session.lastTrackedAt ?? now,
      elapsedSeconds,
    );
  }

  await markParticipantSeenTx(
    tx,
    session,
    clientInstanceId,
    now,
    action === 'stop' ? now : null,
  );

  // A stop ends the session only once the last device has gone, so a second
  // device keeps reading uninterrupted.
  const shouldEnd =
    action === 'stop' &&
    (await countActiveParticipantsTx(tx, session.id, cutoff)) === 0;
  const nextDurationSeconds = session.durationSeconds + elapsedSeconds;

  const updatedSession = await tx.readingSession.update({
    where: {
      id: session.id,
    },
    data: {
      durationMinutes: Math.floor(nextDurationSeconds / 60),
      durationSeconds: nextDurationSeconds,
      endedAt: shouldEnd ? now : null,
      lastTrackedAt: now,
      trackedDay: startOfUtcDay(now),
    },
    select: lockedSessionSelect,
  });

  if (elapsedSeconds > 0) {
    await syncReadingProgressMinutesTx(
      tx,
      session.userId,
      session.libraryItemId,
    );
  }

  return updatedSession;
}
