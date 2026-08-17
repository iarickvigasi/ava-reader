import { computeElapsedSeconds } from './session-segments';
import {
  clampReplayDuration,
  validateReplayTimestamps,
} from './session-validators';

export type OfflineReplayRequest = {
  clientSessionId: string | null;
  endedAt: string | null;
  startedAt: string | null;
};

export type ResolvedOfflineReplay = {
  clamped: boolean;
  clientSessionId: string | null;
  durationSeconds: number;
  endedAt: Date | null;
  isReplay: boolean;
  requestedSeconds: number;
  startedAt: Date | null;
};

// Turns the three offline fields into a decision the transaction can act on.
// Does no I/O, so the caller can validate and log before touching the database.
export function resolveOfflineReplay(
  request: OfflineReplayRequest,
): ResolvedOfflineReplay {
  const startedAt = request.startedAt ? new Date(request.startedAt) : null;
  const endedAt = request.endedAt ? new Date(request.endedAt) : null;
  // A completed-session replay is identified by all three offline fields being
  // present. clientSessionId alone (no timestamps) is a live session with a
  // stable id and stays on the participant-tracked path.
  const isReplay = Boolean(request.clientSessionId && startedAt && endedAt);
  const base = {
    clientSessionId: request.clientSessionId,
    endedAt,
    startedAt,
  };

  if (!isReplay) {
    return {
      ...base,
      clamped: false,
      durationSeconds: 0,
      isReplay: false,
      requestedSeconds: 0,
    };
  }

  const validated = validateReplayTimestamps(startedAt, endedAt);
  const requestedSeconds = computeElapsedSeconds(
    validated.startedAt,
    validated.endedAt,
  );
  const clamp = clampReplayDuration(requestedSeconds);

  return {
    ...base,
    clamped: clamp.clamped,
    durationSeconds: clamp.seconds,
    isReplay: true,
    requestedSeconds,
  };
}
