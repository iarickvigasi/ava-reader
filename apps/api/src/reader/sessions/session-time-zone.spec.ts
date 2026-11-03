import { sessionTimeZone } from './session-time-zone';

it('validates the captured IANA zone and identifies missing values', () => {
  expect(sessionTimeZone('Europe/Belgrade')).toBe('Europe/Belgrade');
  expect(sessionTimeZone(undefined)).toBeNull();
  expect(sessionTimeZone(null)).toBeNull();
  for (const value of ['', 'invalid/zone', 42]) {
    expect(() => sessionTimeZone(value)).toThrow('timeZone');
  }
});
