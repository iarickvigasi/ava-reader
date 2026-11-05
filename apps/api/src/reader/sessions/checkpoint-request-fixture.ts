import { validateCheckpoint } from './validate-checkpoint';

export function makeCheckpoint(
  minutes: number,
  revision: number,
  closed = false,
  id = 'client',
) {
  const startedAt = '2026-11-03T10:00:00.000Z';
  const checkpointAt = new Date(
    Date.parse(startedAt) + minutes * 60_000,
  ).toISOString();
  return validateCheckpoint({
    clientSessionId: id,
    startedAt,
    checkpointAt,
    revision,
    timeZone: 'UTC',
    endedAt: closed ? checkpointAt : null,
  });
}
