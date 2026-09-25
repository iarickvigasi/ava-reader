import { sessionTimeZone } from './session-time-zone';
import { resolveOfflineReplay } from './resolve-offline-replay';

it('validates the captured IANA zone and leaves old sessions unknown', () => {
  expect(sessionTimeZone('Europe/Belgrade')).toBe('Europe/Belgrade');
  expect(sessionTimeZone(undefined)).toBeNull();
  expect(sessionTimeZone(null)).toBeNull();
  for (const value of ['', 'invalid/zone', 42]) {
    expect(() => sessionTimeZone(value)).toThrow('timeZone');
  }
});
it('retains the original zone when replaying an offline session', () => {
  const replay = resolveOfflineReplay({
    clientSessionId: 'offline',
    startedAt: '2026-09-24T22:10:00Z',
    endedAt: '2026-09-24T22:50:00Z',
    timeZone: 'Europe/Belgrade',
  });
  expect(replay).toMatchObject({
    timeZone: 'Europe/Belgrade',
    durationSeconds: 2400,
  });
});
