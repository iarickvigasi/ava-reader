import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import type { UsersService } from '../../users/users.service';
import { applySessionActionTx } from './apply-session-action';
import { lockOwnedSessionTx } from './lock-session';
import type { LockedSessionRecord } from './session-record';
import {
  validateClientInstanceId,
  validateSessionId,
} from './session-validators';

// Heartbeat and stop differ only in the action they apply to the locked row.
export async function runSessionAction(params: {
  action: 'heartbeat' | 'stop';
  clerkUserId: string;
  clientInstanceId: string;
  libraryItemId: string;
  prisma: PrismaService;
  sessionId: string;
  usersService: UsersService;
}): Promise<LockedSessionRecord> {
  const {
    action,
    clerkUserId,
    clientInstanceId,
    libraryItemId,
    prisma,
    sessionId,
    usersService,
  } = params;

  validateSessionId(sessionId);
  validateClientInstanceId(clientInstanceId);
  const user = await usersService.getCurrentUserRecord(clerkUserId);
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const lockedSession = await lockOwnedSessionTx(
      tx,
      user.id,
      libraryItemId,
      sessionId,
    );

    if (!lockedSession) {
      throw new NotFoundException('The reading session was not found.');
    }

    // An already-ended session is returned untouched: a late heartbeat or a
    // duplicate stop must not reopen or re-date it.
    if (lockedSession.endedAt) {
      return lockedSession;
    }

    return applySessionActionTx(
      tx,
      lockedSession,
      now,
      clientInstanceId,
      action,
    );
  });
}
