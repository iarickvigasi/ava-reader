import { Prisma } from '@prisma/client';
import type { ReaderSessionPayload } from '../reader-payload-types';

export const lockedSessionSelect = {
  durationSeconds: true,
  endedAt: true,
  id: true,
  lastTrackedAt: true,
  libraryItemId: true,
  startedAt: true,
  trackedDay: true,
  userId: true,
} satisfies Prisma.ReadingSessionSelect;

export type LockedSessionRecord = Prisma.ReadingSessionGetPayload<{
  select: typeof lockedSessionSelect;
}>;

export function serializeSession(session: {
  durationSeconds: number;
  endedAt: Date | null;
  id: string;
  lastTrackedAt: Date | null;
  startedAt: Date;
}): ReaderSessionPayload {
  return {
    durationSeconds: session.durationSeconds,
    endedAt: session.endedAt?.toISOString() ?? null,
    lastTrackedAt: session.lastTrackedAt?.toISOString() ?? null,
    sessionId: session.id,
    startedAt: session.startedAt.toISOString(),
  };
}
