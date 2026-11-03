import { BadRequestException } from '@nestjs/common';
import { sessionTimeZone } from './session-time-zone';
import type { CheckpointRequest, ReadingCheckpoint } from './checkpoint-types';

const MAX_SESSION_SECONDS = 86_400;
const MAX_REVISION = 2_147_483_647;
const MILLISECONDS_PER_SECOND = 1000;

export function validateCheckpoint(
  input: CheckpointRequest,
): ReadingCheckpoint {
  validateCheckpointIdentity(input);
  const interval = parseCheckpointInterval(input);
  return {
    clientSessionId: input.clientSessionId,
    revision: input.revision,
    ...interval,
    durationSeconds: Math.min(
      MAX_SESSION_SECONDS,
      Math.round(
        (+interval.checkpointAt - +interval.startedAt) /
          MILLISECONDS_PER_SECOND,
      ),
    ),
  };
}

function validateCheckpointIdentity(input: CheckpointRequest) {
  if (
    !input ||
    typeof input.clientSessionId !== 'string' ||
    !input.clientSessionId.trim() ||
    input.clientSessionId.length > 128 ||
    !Number.isInteger(input.revision) ||
    input.revision < 1 ||
    input.revision > MAX_REVISION
  ) {
    throw new BadRequestException(
      'A valid session ID and revision are required.',
    );
  }
}

function parseCheckpointInterval(input: CheckpointRequest) {
  const startedAt = parseTimestamp(input.startedAt);
  const checkpointAt = parseTimestamp(input.checkpointAt);
  const endedAt = input.endedAt === null ? null : parseTimestamp(input.endedAt);
  const timeZone = sessionTimeZone(input.timeZone);
  if (
    !timeZone ||
    checkpointAt < startedAt ||
    (endedAt && +endedAt !== +checkpointAt)
  ) {
    throw new BadRequestException(
      'The checkpoint interval or timezone is invalid.',
    );
  }
  return { startedAt, checkpointAt, endedAt, timeZone };
}

function parseTimestamp(value: unknown): Date {
  const date = typeof value === 'string' ? new Date(value) : new Date(NaN);
  if (!Number.isFinite(+date)) {
    throw new BadRequestException('Checkpoint timestamps must be valid dates.');
  }
  return date;
}
