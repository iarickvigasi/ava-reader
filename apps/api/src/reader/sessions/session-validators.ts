import { BadRequestException } from '@nestjs/common';

// Upper bound for a single replayed offline session. A span longer than this is
// almost certainly a buggy/skewed client clock; we clamp to it (and log) so a
// replay can't inflate reading-hour totals.
const MAX_REPLAY_SESSION_SECONDS = 86_400;

export function validateSessionId(sessionId: string) {
  if (!sessionId?.trim()) {
    throw new BadRequestException('A valid reader session id is required.');
  }
}

export function validateClientInstanceId(clientInstanceId: string) {
  if (!clientInstanceId?.trim()) {
    throw new BadRequestException(
      'A valid reader client instance id is required.',
    );
  }
}

// Returns the validated pair so callers get non-null Dates without casting.
export function validateReplayTimestamps(
  startedAt: Date | null,
  endedAt: Date | null,
): { endedAt: Date; startedAt: Date } {
  if (
    !startedAt ||
    !endedAt ||
    Number.isNaN(startedAt.getTime()) ||
    Number.isNaN(endedAt.getTime())
  ) {
    throw new BadRequestException(
      'Replayed session timestamps must be valid dates.',
    );
  }
  if (endedAt.getTime() < startedAt.getTime()) {
    throw new BadRequestException(
      'A replayed session cannot end before it started.',
    );
  }
  return { endedAt, startedAt };
}

// Pure, so the caller owns the logging; `clamped` tells it whether to warn.
export function clampReplayDuration(seconds: number): {
  clamped: boolean;
  seconds: number;
} {
  if (seconds > MAX_REPLAY_SESSION_SECONDS) {
    return { clamped: true, seconds: MAX_REPLAY_SESSION_SECONDS };
  }
  return { clamped: false, seconds };
}
