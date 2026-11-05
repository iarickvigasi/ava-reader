import { BadRequestException, ConflictException } from '@nestjs/common';
import type { ReadingSession } from '@prisma/client';
import type { ReadingCheckpoint } from './checkpoint-types';

export function checkpointShouldAdvance(
  session: ReadingSession,
  checkpoint: ReadingCheckpoint,
  libraryItemId: string,
): boolean {
  if (
    session.trackingVersion !== 2 ||
    session.libraryItemId !== libraryItemId ||
    +session.startedAt !== +checkpoint.startedAt ||
    session.timeZone !== checkpoint.timeZone
  ) {
    throw new ConflictException(
      'The checkpoint does not match its original session.',
    );
  }
  if (checkpoint.revision <= session.checkpointRevision) return false;
  if (
    session.endedAt &&
    (!checkpoint.endedAt || +checkpoint.endedAt !== +session.endedAt)
  ) {
    throw new ConflictException(
      'A completed reading session cannot reopen or extend.',
    );
  }
  if (
    checkpoint.durationSeconds < session.durationSeconds ||
    (session.lastTrackedAt && checkpoint.checkpointAt < session.lastTrackedAt)
  ) {
    throw new BadRequestException(
      'A checkpoint cannot shorten recorded reading time.',
    );
  }
  return true;
}
